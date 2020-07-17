import { DTOsMap, IOProvider, Ctor, FilterGroup } from "./types";
export interface RepositoryReadonly<D extends DTOsMap, E extends keyof D> {
    /** find one entity object with a specific id, throws exception if not found */
    findAsync(id: string): Promise<D[E]["fromStorage"]>;
    /** get entity objects with optional parent and additional filters ... */
    getAsync(args: {
        parentId: string;
        filters?: FilterGroup<D[E]["fromStorage"]>;
    }): Promise<D[E]["fromStorage"][]>;
}
export interface RepositoryEditable<D extends DTOsMap, E extends keyof D> extends RepositoryReadonly<D, E> {
    saveAsync: (obj: D[E]["toStorage"]) => Promise<D[E]["fromStorage"]>;
}
export interface Repository<D extends DTOsMap, E extends keyof D> extends RepositoryEditable<D, E> {
    deleteAsync: (id: string) => Promise<void>;
}
export declare type RepositoryGroup<D extends DTOsMap> = {
    [key in keyof D]: Repository<D, Extract<keyof D, string>>;
};
/**
 *
 * @param ioProviderClass
 * @param repos The individual repositories: tables, users...
 */
export declare function generate<X, D extends DTOsMap>(ioProviderClass: Ctor<object, IOProvider<X, D>>): new (config: object, dtoNames: Extract<keyof D, string>[]) => RepositoryGroup<D>;
