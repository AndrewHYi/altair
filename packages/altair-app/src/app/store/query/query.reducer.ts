import { Action } from '@ngrx/store';

import { initialQuery } from './initialQuery';

import * as query from '../../store/query/query.action';
import { getAltairConfig } from '../../config';
import { getFullUrl } from '../../utils';
import { WEBSOCKET_PROVIDER_ID } from 'app/services/subscriptions/providers/ws';

export interface QueryEditorState {
  isFocused: boolean;
  // Adding undefined for backward compatibility
  cursorIndex?: number;
}

export interface SubscriptionResponse {
  response: string;
  responseObj: any;
  responseTime: number;
}

export type SelectedOperation = string | null;

export interface State {
  url: string;
  subscriptionUrl: string;
  // Adding undefined for backward compatibility
  query?: string;
  // Adding undefined for backward compatibility
  selectedOperation?: SelectedOperation;
  // Adding undefined for backward compatibility
  operations?: any[];
  httpVerb: 'POST' | 'GET' | 'PUT' | 'DELETE';
  response: any;
  responseTime: number;
  responseStatus: number;
  responseStatusText: string;
  showUrlAlert: boolean;
  urlAlertMessage: string;
  urlAlertSuccess: boolean;
  showEditorAlert: boolean;
  editorAlertMessage: string;
  editorAlertSuccess: boolean;
  subscriptionClient: any;
  subscriptionConnectionParams: string;
  subscriptionProviderId?: string;
  isSubscribed: boolean;
  subscriptionResponseList: SubscriptionResponse[];
  autoscrollSubscriptionResponse: boolean;

  queryEditorState: QueryEditorState;
}

export const getInitialState = (): State => {
  const altairConfig = getAltairConfig();

  return {
    url: getFullUrl(altairConfig.initialData.url ? '' + altairConfig.initialData.url : ''),
    subscriptionUrl: altairConfig.initialData.subscriptionsEndpoint ? '' + altairConfig.initialData.subscriptionsEndpoint : '',
    query: altairConfig.initialData.query ? '' + altairConfig.initialData.query : initialQuery,
    selectedOperation: null,
    operations: [],
    httpVerb : 'POST',
    response: null,
    responseTime: 0,
    responseStatus: 0,
    responseStatusText: '',
    showUrlAlert: false,
    urlAlertMessage: 'URL has been set',
    urlAlertSuccess: true,
    showEditorAlert: false,
    editorAlertMessage: 'Query is set',
    editorAlertSuccess: true,
    subscriptionClient: null,
    subscriptionConnectionParams: '{}',
    subscriptionProviderId: WEBSOCKET_PROVIDER_ID,
    isSubscribed: false,
    subscriptionResponseList: [],
    autoscrollSubscriptionResponse: false,
    queryEditorState: {
      isFocused: false,
    },
  }
};

export function queryReducer(state = getInitialState(), action: query.Action): State {
  switch (action.type) {
    case query.SET_QUERY:
    case query.SET_QUERY_FROM_DB:
      return Object.assign({}, state, { query: action.payload || '' });
    case query.SET_URL:
    case query.SET_URL_FROM_DB:
      return Object.assign({}, state, { url: action.payload.url });
    case query.SET_SUBSCRIPTION_URL:
      return Object.assign({}, state, { subscriptionUrl: action.payload.subscriptionUrl });
    case query.SET_QUERY_RESULT:
      return Object.assign({}, state, { response: action.payload });
    case query.SET_SELECTED_OPERATION:
      return Object.assign({}, state, { selectedOperation: action.payload.selectedOperation });
    case query.SET_RESPONSE_STATS:
      return Object.assign({}, state, {
        responseTime: action.payload.responseTime,
        responseStatus: action.payload.responseStatus,
        responseStatusText: action.payload.responseStatusText
      });
    case query.START_SUBSCRIPTION:
      return Object.assign({}, state, { isSubscribed: true });
    case query.STOP_SUBSCRIPTION:
      return Object.assign({}, state, { isSubscribed: false });
    case query.SET_SUBSCRIPTION_CONNECTION_PARAMS:
      return { ...state, subscriptionConnectionParams: action.payload.connectionParams };
    case query.SET_SUBSCRIPTION_PROVIDER_ID:
      return { ...state, subscriptionProviderId: action.payload.providerId };
    case query.SET_SUBSCRIPTION_CLIENT:
      return Object.assign({}, state, { subscriptionClient: action.payload.subscriptionClient });
    case query.ADD_SUBSCRIPTION_RESPONSE:
      return Object.assign({}, state, {
        subscriptionResponseList: [...state.subscriptionResponseList, {
          response: action.payload.response,
          responseTime: action.payload.responseTime,
          responseObj: action.payload.responseObj,
        }]
      });
    case query.SET_SUBSCRIPTION_RESPONSE_LIST:
      return Object.assign({}, state, { subscriptionResponseList: action.payload.list });
    case query.TOGGLE_AUTOSCROLL_SUBSCRIPTION_RESPONSE:
      return { ...state, autoscrollSubscriptionResponse: !state.autoscrollSubscriptionResponse };
    case query.SET_HTTP_VERB:
      return Object.assign({}, state, { httpVerb: action.payload.httpVerb });
    case query.SET_QUERY_OPERATIONS:
      return Object.assign({}, state, { operations: action.payload.operations });
    case query.SET_QUERY_EDITOR_STATE:
      return { ...state, queryEditorState: action.payload };
    default:
      return state;
  }
}
