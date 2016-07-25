/**
 * This module contains configuration elements to setup the runtime of
 * the service.
 */

export namespace config {

    /**
     * Configuration interface of the service.
     */
    export interface Interface {
        http?: {
            port: number;
            host: string;
        };
        redis?: {
            host: string;
            port: number;
            password?: string;
            db?: number;
        };
        components?: Array<string>;
    }
}
