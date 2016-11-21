/// <reference path="../typings/index.d.ts" />
import * as Immutable from 'immutable';
import { EventEmitter } from 'events';
export interface Template<T> {
    name: string;
    url?: string;
    matchesFormat: (url: string) => boolean;
    interval?: number;
    callback: (url: string, body: any, $: CheerioStatic) => T;
}
export interface TemplateWrapper<T> extends Template<T> {
    lastUsed: number;
    lastUsedPriority: number;
}
export interface QueueEntry {
    url: string;
    priority: boolean;
}
export interface ScraperOptions {
    interval: number;
    maxInterval?: number;
}
declare class Scraper<T> extends EventEmitter {
    private templates;
    private options;
    private queue;
    constructor(options: ScraperOptions);
    addTemplate(template: Template<T>): void;
    getTemplates(): {
        [name: string]: Template<T>;
    };
    setOptions(options: ScraperOptions): void;
    getOptions(): ScraperOptions;
    getQueue(): Immutable.List<QueueEntry>;
    addToQueue(url: string, priority?: boolean): void;
    getWaitTimes(): {
        [name: string]: number;
    };
    start(options?: ScraperOptions): void;
    private processNextInQueue();
    private makeRequest(url, template);
    private determineInterval(template);
}
export default Scraper;
