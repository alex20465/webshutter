/// <reference path="../../typings/jasmine/jasmine.d.ts" />

import {component} from '../../src/core';
import {create_configuration} from '../helpers';


describe('component-manager', () => {

    var manager: component.Manager;

    beforeEach( () => {
        var config = create_configuration();

        config.components = [
            './../test/fixtures/testcomp',
            './../test/fixtures/testcomp:testcomp2'
        ];
        manager = new component.Manager(config);
    } );

    afterEach( () => {
        //
    } );

    it( 'should load and find by prototype', () => {
        manager.load();
        expect(manager.findBy(component.processor.Base).length).toBe(1);
    } );

    it( 'should define the static _NAME', () => {
        var expected = [
            'testcomp.ActionComponent',
            'testcomp2.ProcessorComponent',
        ];

        var found: Array<string> = [];
        manager.load();
        var components = manager.findBy(component.Base);

        expect(components.length).toBe(expected.length);
        components.forEach( (com: any) => {
            expect(expected).toContain(com._NAME);
        } );
    } );
});
