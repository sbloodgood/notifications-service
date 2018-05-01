console.log("YOURE IN THE PROVIDER");

import { Fin } from "../fin";
import { RepositoryFactory } from "./Persistence/DataLayer/Repositories/RepositoryFactory";
import { HistoryRepository } from "./Persistence/DataLayer/Repositories/HistoryRepository";
import { SettingsRepository } from "./Persistence/DataLayer/Repositories/SettingsRepository";
import { Notification } from "../Shared/Models/Notification";
import { Repositories } from "./Persistence/DataLayer/Repositories/RepositoryEnum";
import { ISenderInfo } from "./Models/ISenderInfo";
import { NotificationEvent } from "../Shared/Models/NotificationEvent";

declare var fin: Fin;
declare var window: Window & {fin: Fin};
const repositoryFactory = RepositoryFactory.Instance;
const historyRepository = repositoryFactory.getRepository(Repositories.history) as HistoryRepository;
const settingsRepository = repositoryFactory.getRepository(Repositories.settings) as SettingsRepository;

/**
 * @method registerService Registers the service and any functions that can be consumed
 */
async function registerService() {
    // service UUID
    const serviceUUID = "notifications";
    const serviceSenderInfo = { name: 'Notification-Center', uuid: serviceUUID };

    // Register the service
    const providerChannel = await fin.desktop.Service.register();
    console.log("providerChannel", providerChannel);

    // Functions called by the client
    providerChannel.register('create-notification', createNotification);

    // Functions called either by the client or the Notification Center
    providerChannel.register('clear-notification', clearNotification);
    providerChannel.register('fetch-app-notifications', fetchAppNotifications);
    providerChannel.register('clear-app-notifications', clearAppNotifications);

    // Functions called by the Notification Center
    providerChannel.register('notification-clicked', notificationClicked);
    providerChannel.register('notification-closed', notificationClosed);
    providerChannel.register('fetch-all-notifications', fetchAllNotifications);
    providerChannel.register('clear-all-notifications', clearAllNotifications);

    // Functions called within the Service
    window.fin.notifications = {
        notificationCreated: async (payload: Notification & ISenderInfo) => {
            // Send notification created to the UI
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch(serviceSenderInfo, 'notification-created', payload);
            console.log("success", success);
        },
        notificationCleared: async (payload: { id: string } & ISenderInfo) => {
            // Send notification cleared to the UI
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch(serviceSenderInfo, 'notification-cleared', payload);
            console.log("success", success);
        },
        appNotificationsCleared: async (payload: {uuid: string}) => {
            // Send app notifications cleared to the UI
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch(serviceSenderInfo, 'app-notifications-cleared', payload);
            console.log("success", success);
        },
        notificationClicked: async (payload: NotificationEvent) => {
            // Send notification clicked to the Client
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch({ name: payload.name, uuid: payload.uuid }, 'notification-clicked', payload);
            console.log("success", success);
        },
        notificationClosed: async (payload: NotificationEvent) => {
            // Send notification closed to the Client
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch({ name: payload.name, uuid: payload.uuid }, 'notification-closed', payload);
            console.log("success", success);
        },
        allNotificationsCleared: async (payload: NotificationEvent) => {
            const providerChannelPlugin = await providerChannel;
            const success = await providerChannelPlugin.dispatch(serviceSenderInfo, 'all-notifications-cleared', payload);
            console.log("success", success);
        }
    };
}

/**
 * @description Main entry point to the service
 */
fin.desktop.main(() => {
    registerService();

    let baseUrl = '/ui';
    if (window.location.href.indexOf('cdn.openfin.co') > -1) {
        baseUrl = 'https://cdn.openfin.co/services/openfin/notifications/ui';
    }
    const pageUrl = baseUrl + "/index.html";
    const favUrl = baseUrl + "/favicon.ico";

    console.log("launching UI from: " + pageUrl);

    const notificationCenter = new fin.desktop.Window({
        name: "Notification-Center",
        url: pageUrl,
        autoShow: true,
        defaultHeight: 400,
        defaultWidth: 500,
        resizable: false,
        saveWindowState: false,
        defaultTop: 0,
        frame: false,
        smallWindow: true,
        icon: favUrl,
        applicationIcon: favUrl,
        "showTaskbarIcon": false        
    },  () => {
        console.log("WINDOW SUCCESSFULLY CREATED");
    }, (error: string) => {
        console.log("Error creating window:", error);
    });
});

/**
 * Encodes the Id which currently is the uuid:id
 * @param payload The notification object
 */
function encodeID(payload: Notification & ISenderInfo | NotificationEvent | { id: string } & ISenderInfo): string {
    return `${payload.uuid}:${payload.id}`;
}

/**
 * @method decodeID This function retrieves the notification Id
 * @param payload The notification object
 */
function decodeID(payload: Notification & ISenderInfo | NotificationEvent | { id: string } & ISenderInfo): string {
    return payload.id.slice(payload.uuid.length + 1);
}

/**
 * @method createNotification Create the notification and dispatch it to the UI
 * @param {object} payload The contents to be dispatched to the UI
 * @param {object} sender Window info for the sending client. This can be found in the relevant app.json within the demo folder.
 */
async function createNotification(payload: Notification, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("createNotification hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('createNotification', payload, sender);

    const fullPayload: Notification & ISenderInfo = Object.assign({}, payload, sender);
    const encodedID: string = encodeID(fullPayload);
    const fullPayloadEncoded: Notification & ISenderInfo = Object.assign({}, fullPayload, { id: encodedID });

    // Manipulate notification data store
    const result = await historyRepository.create(fullPayloadEncoded);

    // Create the notification/toast in the UI
    if (result.success) {
        fin.notifications.notificationCreated(fullPayload);
    }

    // Return a notification event with the notification context/id to the client that created the notification
    // Or return the payload?
    return result;
}

/**
 * @method clearNotification Tell the UI to delete a specific notification
 * @param {object} payload Should contain the id of the notification we want to delete. Maybe should just be a string
 * @param {object} sender Window info for the sending client. This can be found in the relevant app.json within the demo folder.
 * @returns {ReturnResult} Whether or not the removal of the notifications was successful.
 */
async function clearNotification(payload: Notification, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("clearNotification hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('clearNotification', payload, sender);

    // Grab notificationID from payload. If not present, return error?
    if (!payload.id) {
        return "ERROR: Must supply a notification ID to clear!";
    }

    const fullPayload: { id: string } & ISenderInfo = Object.assign({}, payload, sender);
    const encodedID: string = encodeID(fullPayload);

    // Delete notification from indexeddb
    const result = await historyRepository.remove(encodedID);

    // Delete the notification/toast in UI
    if (result.success) {
        fin.notifications.notificationCleared(fullPayload);
    }

    return result;
}

/**
 * @method notificationClicked Tell the Client that a notification was clicked
 * @param {object} payload Should contain the id of the notification clicked. Also the uuid and name of the original Client window.
 * @param {object} sender UI Window info. Not important.
 */
function notificationClicked(payload: Notification & ISenderInfo, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("notificationClicked hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('notificationClicked', payload, sender);

    // Send notification clicked event to uuid with the context.
    fin.notifications.notificationClicked(payload);

    // TODO: What should we return?
    return "notificationClicked returned";
}

/**
 * @method notificationClosed Tell the Client that a notification was closed, and delete it from indexeddb
 * @param {object} payload Should contain the id of the notification clicked. Also the uuid and name of the original Client window.
 * @param {object} sender UI Window info. Not important.
 */
async function notificationClosed(payload: NotificationEvent, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("notificationClosed hit");
    
    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('notificationClosed', payload, sender);

    const encodedID: string = encodeID(payload);

    // Delete notification from indexeddb
    const result = await historyRepository.remove(encodedID);

    // Send notification closed event to uuid with the context.
    if (result.success) {
        fin.notifications.notificationCleared(payload);
        fin.notifications.notificationClosed(payload);
    }

    // TODO: What should we return?
    return result;
}

/**
 * @method fetchAllNotifications Grab all notifications from the Service and return it to the UI.
 * @param {object} payload Not important
 * @param {object} sender Not important.
 */
async function fetchAllNotifications(payload: undefined, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("fetchAllNotifications hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('fetchAllNotifications', payload, sender);

    // Grab all notifications from indexeddb.
    const result = await historyRepository.getAll();

    if (result.success) {
        const allNotifications = result.value as Array<Notification & ISenderInfo>;

        allNotifications.forEach((notification) => {
            notification.id = decodeID(notification);
        });

        result.value = allNotifications;
    }

    return result;
}

/**
 * @method fetchAppNotifications This allows you to fetch apps via your uuid
 * @param {undefined} payload The payload can contain the uuid
 * @param {ISenderInfo} sender The sender info contains the uuid of the sender
 */
async function fetchAppNotifications(payload: NotificationEvent, sender: ISenderInfo) {
    // For testing/display purposes
    console.log("fetchAppNotifications hit");
    
    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('fetchAppNotifications', payload, sender);
    
    // If no uuid supplied in the payload, set to the sender's uuid. This is so you can request another app's notification (such as for the Notification Center)
    if (!payload.uuid) {
        payload.uuid = sender.uuid;
    }

    // Grab an app's notifications from indexeddb
    // Send those notifications to the requesting app.
    const result = await historyRepository.getByUuid(payload.uuid);

    if (result.success) {
        const appNotifications = result.value as Array<Notification & ISenderInfo>;

        appNotifications.forEach((notification) => {
            console.log("notification", notification);
            notification.id = decodeID(notification);
        });

        result.value = appNotifications;
    }

    return result;
}

/**
 * @method clearAllNotifications Clears all notifications in the database
 * @param {undefined} payload Not important
 * @param {ISenderInfo} sender Not important
 */
async function clearAllNotifications(payload: Notification, sender: ISenderInfo) {
    console.log("clearAllNotifications hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('clearAllNotifications', payload, sender);
    
    // Delete app notifications from indexeddb

    const result = await historyRepository.removeAll();

    if (result.success) {
        fin.notifications.allNotificationsCleared(payload);
    }

    // TODO: What should we return?
    return "clearAllNotifications returned";
}

function clearAppNotifications(payload: {uuid: string}, sender: ISenderInfo) {
    console.log("clearAppNotifications hit");

    console.log("payload", payload);
    console.log("sender", sender);

    testDisplay('clearAppNotifications', payload, sender);

    // Delete app notifications from indexeddb
    historyRepository.removeByUuid(payload.uuid);
    
    // Delete the notifications/toasts in UI (TODO: NEED TO REGISTER APP-NOTIFICATIONS-CLEARED IN UI)
    fin.notifications.appNotificationsCleared(payload);


    // TODO: What should we return?
    return "clearAppNotifications returned";
}

/**
 * @method testDisplay Displays test html on the service
 * @param {string} action The action that was hit
 * @param {Notification} payload The notification payload
 * @param {ISenderInfo} sender The sender info
 */
function testDisplay(action: string, payload: Notification | NotificationEvent | {uuid: string}, sender: ISenderInfo) {
    document.body.innerHTML = '';
    document.body.innerHTML += `${action} hit <br></br>`;
    document.body.innerHTML += "PAYLOAD <br></br>";
    const preTagPayload = document.createElement("PRE");
    preTagPayload.textContent = JSON.stringify(payload, null, 4);
    document.body.appendChild(preTagPayload);
    document.body.innerHTML += "SENDER <br></br>";
    const preTagSender = document.createElement("PRE");
    preTagSender.textContent = JSON.stringify(sender, null, 4);
    document.body.appendChild(preTagSender);
}