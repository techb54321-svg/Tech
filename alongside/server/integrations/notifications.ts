// Background reminder delivery.
//
// Not implemented yet: reminders are delivered *in the app* while Alongside is
// open on screen. Background delivery would need Web Push (VAPID keys, a
// service-worker push handler, stored subscriptions and a server scheduler)
// and must be verified on real devices with the app closed. Until then the
// family area explains the limitation and offers a calendar export, which
// lets the device's own calendar raise alerts.
export interface NotificationCapability {
  background: boolean
  summary: string
}

export function notificationCapability(): NotificationCapability {
  return {
    background: false,
    summary:
      'Reminders appear only while Alongside is open on the screen. Background notifications are not set up. ' +
      'For alerts when the app is closed, add the calendar export to the device’s calendar.',
  }
}
