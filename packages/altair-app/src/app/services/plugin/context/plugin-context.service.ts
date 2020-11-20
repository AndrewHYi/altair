import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { debug } from 'app/utils/logger';

import { WindowService } from 'app/services/window.service';

import * as fromRoot from 'app/store';
import * as fromWindows from 'app/store/windows/windows.reducer';

import * as queryActions from 'app/store/query/query.action';
import * as variablesActions from 'app/store/variables/variables.action';
import * as localActions from 'app/store/local/local.action';

import is_electron from 'app/utils/is_electron';
import { PluginEventService, PluginEvent, PluginEventCallback } from '../plugin-event.service';
import { AltairPanelLocation, AltairPanel, AltairPlugin, AltairUiAction, AltairUiActionLocation } from '../plugin';
import { first } from 'rxjs/operators';

interface CreatePanelOptions {
  title?: string;
  location?: AltairPanelLocation;
}

interface CreateActionOptions {
  title: string;
  location: AltairUiActionLocation;
  execute: (data: PluginWindowState) => void;
}

interface PluginWindowState extends fromWindows.ExportWindowState {
  windowId: string;
  sdl: string;
}

@Injectable({
  providedIn: 'root'
})
export class PluginContextService {
  constructor(
    private store: Store<fromRoot.State>,
    private windowService: WindowService,
    private pluginEventService: PluginEventService,
  ) {}

  createContext(pluginName: string, plugin: AltairPlugin) {
    const self = this;
    const log = (msg: string) => debug.log(`PLUGIN[${pluginName}]: ${msg}`);
    const eventBus = this.pluginEventService.group();

    log('creating context..');
    return {
      app: {
        /**
         * Returns an allowed set of data from the state visible to plugins
         *
         * Since it is a method, the state can be generated when called.
         * So we can ensure uniqueness of the state, as well as avoid passing values by references.
         */
        async getWindowState(windowId: string) {
          return self.getWindowState(windowId);
        },

        async getCurrentWindowState() {
          return self.getCurrentWindowState();
        },
        /**
         * panel has two locations: sidebar, header
         *
         * Each call creates a new panel. Instead, plugin should create panel only once (@initialize)
         * Panel can be destroyed when the plugin is unused.
         *
         * returns panel instance (includes destroy() method)
         */
        createPanel(
          element: HTMLElement,
          { location = AltairPanelLocation.SIDEBAR, title = plugin.display_name }: CreatePanelOptions = {},
        ) {
          log(`Creating panel<${title}>`);
          const panel = new AltairPanel(title, element, location);
          self.store.dispatch(new localActions.AddPanelAction(panel));
          return panel;
        },
        destroyPanel(panel: AltairPanel) {
          log(`Destroying panel<${panel.title}:[${panel.id}]>`);
          if (panel instanceof AltairPanel) {
            panel.destroy();
            self.store.dispatch(new localActions.RemovePanelAction({ panelId: panel.id }));
          }
        },
        /**
         * action has 1 location for now: resultpane
         *
         * Each call creates a new action. Instead, plugins should create action once, when needed
         * Action can be destroyed when the plugin decides to.
         *
         * returns action instance (includes destroy() method)
         */
        createAction({
          title,
          location = AltairUiActionLocation.RESULT_PANE,
          execute,
        }: CreateActionOptions) {
          log(`Creating ui action<${title}>`);
          const uiAction = new AltairUiAction(title, location, async() => {
            const state = await self.getCurrentWindowState();
            execute(state);
          });

          self.store.dispatch(new localActions.AddUiActionAction(uiAction));

          return uiAction;
        },
        destroyAction(uiAction: AltairUiAction) {
          log(`Destroying ui action<${uiAction.title}:[${uiAction.id}]>`);
          if (uiAction instanceof AltairUiAction) {
            self.store.dispatch(new localActions.RemoveUiActionAction({ actionId: uiAction.id }));
          }
        },
        isElectron() {
          return is_electron;
        },
        createWindow(data: fromWindows.ExportWindowState) {
          log('creating window');
          return self.windowService.importWindowData(data);
        },
        setQuery(windowId: string, query: string) {
          log('setting query');
          self.store.dispatch(new queryActions.SetQueryAction(query, windowId));
        },
        setVariables(windowId: string, variables: string) {
          log('setting variables');
          self.store.dispatch(new variablesActions.UpdateVariablesAction(variables, windowId));
        },
        setEndpoint(windowId: string, url: string) {
          log('setting endpoint');
          self.store.dispatch(new queryActions.SetUrlAction({ url }, windowId));
          self.store.dispatch(new queryActions.SendIntrospectionQueryRequestAction(windowId));
        },
        executeCommand() {
          // TODO: To be implemented...
        },
      },
      events: {
        /**
         * is-active (plugin is active)
         * is-inactive (plugin is inactive)
         * app-ready
         */
        on<E extends PluginEvent>(event: E, callback: PluginEventCallback<E>) {
          return eventBus.on(event, callback);
        },

        /**
         * Unsubscribe to all events
         */
        off() {
          log('unsubscribing from all events');
          return eventBus.unsubscribe();
        },
      },
    };
  }

  private async getWindowState(windowId: string) {
    const data = await this.store.select(fromRoot.selectWindowState(windowId)).pipe(first()).toPromise();

    const pluginWindowState: PluginWindowState = {
      version: 1,
      type: 'window',
      query: data.query.query || '',
      apiUrl: data.query.url,
      variables: data.variables.variables,
      subscriptionUrl: data.query.subscriptionUrl,
      headers: data.headers,
      windowName: data.layout.title,
      preRequestScript: data.preRequest.script,
      preRequestScriptEnabled: data.preRequest.enabled,
      sdl: data.schema.sdl,
      windowId: windowId,
    };

    return pluginWindowState;
  }

  private async getCurrentWindowState() {
    const windowMeta = await this.store.select('windowsMeta').pipe(first()).toPromise();
    return this.getWindowState(windowMeta.activeWindowId);
  }
}
