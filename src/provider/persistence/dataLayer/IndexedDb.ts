﻿import {ITable} from '../models/ITable';
import {PageInfo} from '../models/PageInfo';
import {Sorts} from '../models/Sort';

import {Entity} from './repositories/Repository';
import {IDatastore} from './IDatastore';

/**
 * @description An IndexedDb implementation implementing the IDatastore
 * interface
 */
export class IndexedDb<T extends Entity> implements IDatastore<T> {
    /**
     * @property Holds an instance of the datastore
     */
    private mIndexedDb: IDBFactory;

    /**
     * @property Holds an instance of open store
     */
    private mDbOpenRequest!: IDBOpenDBRequest;

    /**
     * @class Constructor for IndexedDb
     */
    constructor(db: IDBFactory) {
        this.mIndexedDb = db;
    }

    /**
     * @function initialise Initialises the database and does all setup
     * @param {number} dbVersion The version of the database
     * @param {ITable[]} tablesToCreate These are needed in order to recreate the table names should the version be upgraded
     * @public
     */
    public initialise(dbVersion: number, tablesToCreate: ITable[]): void {
        if (!dbVersion) {
            console.error('No database name has been passed in');
            return;
        }

        this.mDbOpenRequest = this.mIndexedDb.open('Notifications', dbVersion);

        this.mDbOpenRequest.onupgradeneeded = (event: Event) => {
            const db = (event.target as IDBOpenDBRequest).result as IDBDatabase;
            try {
                tablesToCreate.forEach(table => {
                    if (!db.objectStoreNames.contains(table.name)) {
                        const store = db.createObjectStore(table.name, {keyPath: 'id'});

                        if (table.indexName && table.index) {
                            const index = store.createIndex(table.indexName, [table.index]);
                        }
                    }
                });
            } catch (err) {
                console.error('error: ', err);
            }
        };
    }

    /**
     * @function create Add an entry into the database based on the table name
     * @param {string} tableName The name of the table to perform
     * @param {T} entry Object to insert into the database
     * @public
     * @returns {Promise<boolean>} A value of whether it was successfully created or not
     */
    public create<T extends Entity>(tableName: string, entry: T): Promise<boolean> {
        if (!tableName) {
            console.error('No table name has been passed');
            return Promise.reject(new Error('No table name has been passed'));
        }

        if (!entry) {
            console.error('No entry has been passed');
            return Promise.reject(new Error('No entry has been passed'));
        }

        return new Promise((resolve, reject) => {
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.add(entry);

            request.onsuccess = (event: Event) => {
                console.log('The entry has been inserted');
                resolve(true);
            };

            request.onerror = (event: Event) => {
                console.error('The entry could not be inserted: ', event);
                resolve(false);
            };
        });
    }

    /**
     * @function remove Deletes an entry in the database based on the table name
     * @param {string} tableName The name of the table to perform
     * @param {T} id The id of the entry we want to remove
     * @public
     * @returns {Promise<boolean>} A value of whether it was successfully created or not
     */
    public remove<T extends string|number>(tableName: string, id: T): Promise<boolean> {
        if (!tableName) {
            console.error('No table name has been passed');
            return Promise.reject(new Error('No table name has been passed'));
        }

        if (!id) {
            console.error('No id has been passed');
            return Promise.reject(new Error('No id has been passed'));
        }

        return new Promise((resolve, reject) => {
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.delete(id);

            request.onsuccess = (event: Event) => {
                console.log('The entry has been deleted');
                resolve(true);
            };

            request.onerror = (event: Event) => {
                console.error('The entry could not be deleted: ', event);
                resolve(false);
            };
        });
    }

    /**
     * @function removeAll Deletes all entries in the database based on the table
     * name
     * @param {string} tableName The name of the table to perform
     * @public
     * @returns {Promise<boolean>} A value of whether it was successfully created or not
     */
    public removeAll(tableName: string): Promise<boolean> {
        if (!tableName) {
            console.error('No table name has been passed');
            return Promise.reject(new Error('No table name has been passed'));
        }

        return new Promise((resolve, reject) => {
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.clear();

            request.onsuccess = (event: Event) => {
                console.log('The entry has been deleted');
                resolve(true);
            };

            request.onerror = (event: Event) => {
                console.error('The entry could not be deleted: ', event);
                resolve(false);
            };
        });
    }

    /**
     * @function removeByUuid Deletes all entries corresponding to the uuid passed
     * in
     * @param {string} tableName The name of the table to perform
     * @param {string} uuid The uuid of the app
     * @public
     * @returns {Promise<number>} The count of removed entries
     */
    public removeByUuid(tableName: string, uuid: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.readByUuid(tableName, uuid)
                .then((result: T[]) => {
                    result.forEach((notification: T) => {
                        this.remove(tableName, notification.id);
                    });
                    resolve(result.length);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    /**
     * @function update Update an entry into the database based on the table name
     * @param {string} tableName The name of the table to perform
     * @param {T} entry Object to update in the database
     * @public
     * @returns {Promise<boolean>} A value of whether it was successfully created or not
     */
    public update<T extends Entity>(tableName: string, entry: T): Promise<boolean> {
        if (!tableName) {
            console.error('No table name has been passed');
            return Promise.reject(new Error('No table name has been passed'));
        }

        if (!entry) {
            console.error('No entry has been passed');
            return Promise.reject(new Error('No entry has been passed'));
        }

        return new Promise((resolve, reject) => {
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.put(entry);

            request.onsuccess = (event: Event) => {
                console.log('The entry has been updated');
                resolve(true);
            };

            request.onerror = (event: Event) => {
                console.error('The entry could not be updated: ', event);
                resolve(false);
            };
        });
    }

    /**
     * @function read Reads an entry in the database based on the table name
     * @param {string} tableName The name of the table to perform
     * @param {string} id The id of the entry we want to remove
     * @public
     * @returns {Promise<T>} Returns a promise to retrieve the data requested
     */
    public read(tableName: string, id: string): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!tableName) {
                reject(new Error('No table name has been passed'));
            }

            if (!id) {
                reject(new Error('No id has been passed in'));
            }

            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.get(id);

            request.onsuccess = (event: Event) => {
                resolve(request.result);
                console.log('Read has been executed');
            };

            request.onerror = (event: Event) => {
                console.error('The entry could not be updated: ', event);
                resolve(undefined);
            };
        });
    }

    /**
     * @function readAll Reads all rows from the table specified
     * @param {string} tableName The table to be read form
     * @public
     * @returns {Promise<T>} Returns a promise to retrieve the data requested
     */
    public readAll(tableName: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const result: T[] = [];
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readonly');
            const store = transaction.objectStore(tableName);

            const cursorRequest = store.openCursor(undefined, 'next');

            cursorRequest.onsuccess = (event: Event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
                if (cursor) {
                    result.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };

            cursorRequest.onerror = (event: Event) => {
                console.error('Could not read from table ' + tableName, event);
                resolve(undefined);
            };
        });
    }

    /**
     * @function readByUuid Gets all entries from the database corresponding to the
     * Uuid
     * @param tableName The name of the table to perform actions on
     * @param uuid The uuid to query by
     * @public
     * @returns {Promise<T[]>} Returns a promise to retrieve the data requested
     */
    public readByUuid(tableName: string, uuid: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const result: T[] = [];
            const db = this.mDbOpenRequest.result as IDBDatabase;
            const transaction = db.transaction(tableName, 'readonly');
            const store = transaction.objectStore(tableName);

            const cursorRequest = store.openCursor(undefined, 'next');

            cursorRequest.onsuccess = (event: Event) => {
                const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
                if (cursor) {
                    if (cursor.value.source.uuid === uuid) {
                        result.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };

            cursorRequest.onerror = (event: Event) => {
                console.error('Could not read from table ' + tableName, event);
                resolve(undefined);
            };
        });
    }

    /**
     * @function readByPage Gets the result on the page specified
     * @param tableName The table to be read from
     * @param pageInfo The requested page and the number of items to be returned
     * from the apge
     * @public
     * @returns {Promise<T[]>} Returns a promise to retrieve the data requested
     */
    public readByPage(tableName: string, pageInfo: PageInfo): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const result: T[] = [];
            this.readAll(tableName).then((notifications: T[]) => {
                if (notifications.length === 0) {
                    console.error('There are no entries in the database');
                    resolve(undefined);
                } else {
                    const offset = (pageInfo.pageNumber - 1) * pageInfo.numberOfItems;

                    // Depending on which sorting is applied we will
                    if (pageInfo.sort === Sorts.ascending) {
                        for (let i = offset; i < offset + pageInfo.numberOfItems; i++) {
                            if (notifications[i] !== null) {
                                result.push(notifications[i]);
                            }
                        }
                    } else {
                        const reverseLoopOffset = (notifications.length - offset) - 1;
                        for (let i = reverseLoopOffset; i > reverseLoopOffset - pageInfo.numberOfItems; i--) {
                            if (notifications[i] !== null) {
                                result.push(notifications[i]);
                            }
                        }
                    }

                    resolve(result);
                }
            });
        });
    }
}
