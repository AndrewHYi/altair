import { SubscriptionProvider, SubscriptionProviderExecuteOptions } from '../subscription-provider';
import { Observable } from 'rxjs';
import ActionCable from 'actioncable';

export const ACTION_CABLE_PROVIDER_ID = 'action-cable';

export class ActionCableSubscriptionProvider extends SubscriptionProvider {
  subscription?: any;

  execute(options: SubscriptionProviderExecuteOptions) {
    const cable = ActionCable.createConsumer(this.subscriptionUrl);

    return new Observable((subscriber) => {
      this.subscription = cable.subscriptions.create(Object.assign({}, {
        channel: "GraphqlChannel",
        channelId: Math.round(Date.now() + Math.random() * 100000).toString(16)
      }, {}), {
        connected: function() {
          this.perform("execute", options)
        },
        received: function(payload) {
          if (payload.result.data || payload.result.errors) {
            subscriber.next(payload.result)
          }

          if (!payload.more) {
            subscriber.complete()
          }
        }
      })
    });
  }

  close() {
    this.subscription?.unsubscribe()
  }
}
