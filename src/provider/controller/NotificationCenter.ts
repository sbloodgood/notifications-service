import {TrayIconClicked} from 'openfin/_v2/api/events/application';

import {WindowInfo} from './WindowInfo';
declare const window: Window & {WindowManager: NotificationCenter};


export class NotificationCenter {
    private windowInfo: WindowInfo = new WindowInfo();
    private static singleton: NotificationCenter;

    constructor() {
        if (NotificationCenter.singleton) {
            return NotificationCenter.singleton;
        }
        this.setEventListeners();
        NotificationCenter.singleton = this;
        this.setupTrayIcon();
    }

    /**
     * @function setEventListeners Initalizes event listeners for the window
     * @returns void
     */
    public setEventListeners(): void {
        // When window is ready
        window.addEventListener('DOMContentLoaded', this.onWindowLoad.bind(this));

        // On window close requested
        this.windowInfo.getWindow().addEventListener('close-requested', () => this.hideWindow());

        // On monitor dimension change
        fin.desktop.System.addEventListener('monitor-info-changed', this.onMonitorInfoChanged.bind(this));
    }


    private setupTrayIcon() {
        const application = fin.Application.getCurrentSync();
        const icon = 'https://openfin.co/favicon-32x32.png';

        application.addListener('tray-icon-clicked', (event: TrayIconClicked<string, string>) => {
            console.log(event);
            if (event.button === 0) {
                this.toggleWindow();
            }
        });

        application.setTrayIcon(icon);
    }

    /**
     * @function onWindowLoad Fired when the window DOM is loaded
     * @returns void
     */
    public onWindowLoad(): void {
        this.sizeToFit(false);

        document.getElementById('exitLink')!.addEventListener('click', () => this.hideWindow());
    }

    /**
     * @function sizeToFit Sets the window dimensions in shape of a side bar
     * @returns void
     */
    public sizeToFit(forceShow: boolean = false): void {
        fin.desktop.System.getMonitorInfo((monitorInfo: fin.MonitorInfo) => {
            this.windowInfo.getWindow().setBounds(
                monitorInfo.primaryMonitor.availableRect.right - this.windowInfo.getIdealWidth(),
                0,
                this.windowInfo.getIdealWidth(),
                monitorInfo.primaryMonitor.availableRect.bottom,
                () => {
                    if (forceShow) {
                        this.showWindow();
                    }
                },
                (reason: string) => {
                    console.warn('MOVED FAILED', reason);
                }
            );
        });
    }

    /**
     * @function showWindow Shows the Window with Fade()
     * @returns void
     */
    public showWindow(): void {
        this.fade(true, 450);
        this.windowInfo.getWindow().resizeBy(1, 0, 'top-left');
        this.windowInfo.getWindow().resizeBy(-1, 0, 'top-left');
        this.windowInfo.setShowing(true);
    }

    /**
     * @function hideWindow Hides the window with Fade()
     * @returns void
     */
    public hideWindow(): void {
        this.fade(false, 450);
        this.windowInfo.setShowing(false);
    }

    /**
     * @function toggleWindow Hides or shows the center.
     * @returns void
     */
    public toggleWindow(): void {
        if (this.windowInfo.getShowingStatus()) {
            this.hideWindow();
        } else {
            this.showWindow();
        }
    }

    /**
     * @function fade Fades the window in or out
     * @param fadeOut
     * @param timeout
     */
    public fade(fadeOut: boolean, timeout: number): void {
        if (fadeOut) {
            this.windowInfo.getWindow().show();
        }

        this.windowInfo.getWindow().animate({opacity: {opacity: fadeOut ? 1 : 0, duration: timeout}}, {interrupt: false}, () => {
            !fadeOut ? this.windowInfo.getWindow().hide() : this.windowInfo.getWindow().focus();
        });
    }

    /**
     * @function instance Gets this WindowManager instance on the window.
     * @returns WindowManager
     */
    public static get instance(): NotificationCenter {
        if (NotificationCenter.singleton) {
            return NotificationCenter.singleton;
        } else {
            return new NotificationCenter();
        }
    }

    private onMonitorInfoChanged(): void {
        this.sizeToFit();
    }
}
