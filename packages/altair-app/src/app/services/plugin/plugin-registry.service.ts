import { Injectable } from '@angular/core';
import { debug } from 'app/utils/logger';
import { HttpClient } from '@angular/common/http';
import {
  AltairPlugin,
  PluginSource,
  PluginManifest,
  createPlugin,
} from './plugin';
import { Store } from '@ngrx/store';

import * as fromRoot from '../../store';
import * as localActions from '../../store/local/local.action';
import { PluginContextService } from './context/plugin-context.service';
import { PluginStateEntry } from 'app/store/local/local.reducer';

const PLUGIN_NAME_PREFIX = 'altair-graphql-plugin-';

@Injectable()
export class PluginRegistryService {
  private fetchedPlugins: Promise<any>[] = [];

  constructor(
    private http: HttpClient,
    private pluginContextService: PluginContextService,
    private store: Store<fromRoot.State>,
  ) {}

  add(name: string, plugin: AltairPlugin) {
    const context = this.pluginContextService.createContext(name, plugin);
    const PluginClass = this.getPluginClass(plugin);
    const pluginStateEntry: PluginStateEntry = {
      name,
      context,
      instance: PluginClass ? new PluginClass() : undefined,
      plugin,
    };

    if (pluginStateEntry.instance) {
      pluginStateEntry.instance.initialize(context);
    }
    this.store.dispatch(new localActions.AddInstalledPluginEntryAction(pluginStateEntry));
  }

  getRemotePluginList() {
    return this.http.get('https://altair-plugin-server.sirmuel.workers.dev/list?v=2');
  }

  fetchPlugin(name: string, opts: any = {}) {
    if (!name) {
      return;
    }

    // TODO: Check if plugin with name already exists
    this.fetchedPlugins.push(
      this.fetchPluginAssets(name, opts)
    );
  }

  installedPlugins() {
    return this.store.select(state => state.local.installedPlugins);
  }

  /**
   * Given a plugin string in the format: <plugin-source>:<plugin-name>@<version>::[<opt>]->[<opt-value>],
   * it returns the details of the plugin
   * @param pluginStr
   */
  getPluginInfoFromString(pluginStr: string) {
    const matches = pluginStr.match(/(([A-Za-z_]*)\:)?(.[A-Za-z0-9\-]*)(@([^#\:\[\]]*))?(\:\:\[(.*)\]->\[(.*)\])?/);
    if (matches && matches.length) {
      const [, , pluginSource = PluginSource.NPM, pluginName, , pluginVersion = 'latest', , opt, optVal ] = matches;
      if (pluginName && pluginVersion) {
        if (!pluginName.startsWith(PLUGIN_NAME_PREFIX)) {
          throw new Error(`Plugin name must start with ${PLUGIN_NAME_PREFIX}`);
        }
        return {
          name: pluginName,
          version: pluginVersion,
          pluginSource,
          ...opt && optVal && { [opt]: optVal },
        };
      }
    }
    return null;
  }

  pluginsReady() {
    return Promise.all(this.fetchedPlugins);
  }

  private async fetchPluginAssets(name: string, { pluginSource = PluginSource.NPM, version = 'latest', ...remainingOpts }: any = {}) {
    debug.log('PLUGIN: ', name, pluginSource, version);

    let pluginBaseUrl = ``;
    switch (pluginSource) {
      case PluginSource.NPM:
        pluginBaseUrl = this.getNPMPluginBaseURL(name, { version });
        break;
      case PluginSource.URL:
        pluginBaseUrl = this.getURLPluginBaseURL(name, { version, ...remainingOpts });
    }

    const manifestUrl = this.resolveURL(pluginBaseUrl, 'manifest.json');

    try {
      // Get manifest file
      const manifest = (await this.http.get(manifestUrl).toPromise()) as PluginManifest;

      debug.log('PLUGIN', manifest);

      if (manifest) {
        if (manifest.styles && manifest.styles.length) {
          debug.log('PLUGIN styles', manifest.styles);

          await Promise.all(manifest.styles.map(style => {
            return this.injectPluginStylesheet(this.resolveURL(pluginBaseUrl, style));
          }));
        }
        if (manifest.scripts && manifest.scripts.length) {
          debug.log('PLUGIN scripts', manifest.scripts);

          await Promise.all(manifest.scripts.map(script => {
            return this.injectPluginScript(this.resolveURL(pluginBaseUrl, script));
          }));
        }
        const plugin = createPlugin(name, manifest);
        this.add(name, plugin);
        debug.log('PLUGIN', 'plugin scripts and styles injected and loaded.');

        return plugin;
      }
    } catch (error) {
      debug.error('Error fetching plugin assets', error);
    }
  }

  private injectPluginScript(url: string) {
    return new Promise((resolve, reject) => {
      const head = document.getElementsByTagName('head')[0];
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      head.appendChild(script);
    });
  }
  private injectPluginStylesheet(url: string) {
    return new Promise((resolve, reject) => {
      const head = document.getElementsByTagName('head')[0];
      const style = document.createElement('link');
      style.type = 'text/css';
      style.rel = 'stylesheet';
      style.href = url;
      style.onload = () => resolve();
      style.onerror = (err) => reject(err);
      head.appendChild(style);
    });
  }

  private getNPMPluginBaseURL(name: string, { version = 'latest' }) {
    const baseUrl = 'https://cdn.jsdelivr.net/npm/';
    const pluginBaseUrl = `${baseUrl}${name}@${version}/`;
    return pluginBaseUrl;
  }

  private getURLPluginBaseURL(name: string, opts: any) {
    return opts.url;
  }

  private resolveURL(baseURL: string, path: string) {
    return baseURL.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  private getPluginClass(plugin: AltairPlugin) {
    if (plugin.plugin_class) {
      return (window as any)['AltairGraphQL'].plugins[plugin.plugin_class] as any;
    }
    return;
  }
}
