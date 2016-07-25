/// <reference path="../typings/jasmine/jasmine.d.ts" />

import {
    component,
    queue,
    producer
} from '../src/core';

import {create_configuration} from './helpers';

export class IncreaseProcessor extends component.processor.Base implements component.processor.Interface {

    SOURCE = 'source';
    DESTINATION = 'dest:';

    process() {
        var mockJob: producer.job.Base<any> = this.getJob();

        if (mockJob.params < 50) {
            this.finish( mockJob.params + 1 );
        } else if (mockJob.params < 100) {
            this.abort( new Error('to high count!') );
        } else if (mockJob.params < 200 ) {
            var obj: any = {};
            // TypeError
            var obj2 = obj.test.works;
        }
    }

    restoreJob(dump: any) {
        return new producer.job.Base<any>(dump.id, dump.producer_id, dump.params);
    }

}


describe('processor-component', () => {

    var com: component.processor.Base;
    var q: queue.Mock;

    beforeEach( () => {
        var config = create_configuration();

        q = new queue.Mock();
        com = new IncreaseProcessor(config, q);
        com.start();
    } );

    afterEach( () => {
        com.stop();
    } );

    it( 'should process a simple task', (done) => {

        q.put('source', JSON.stringify({
            'params': 1,
            'producer_id': 'none'
        }));

        q.get('dest:none')
            .progress( (control: queue.Control) => {
                var dump = JSON.parse(control.target);
                expect(dump.results).toBe(2);
                control.break();
            } )
            .then(done);
    } );

    it( 'should receive the aborted task', (done) => {
        q.put('source', JSON.stringify({
            'params': 77, // value to high
            'producer_id': 'none'
        }));

        q.get('dest:none')
            .progress( (control: queue.Control) => {
                var dump = JSON.parse(control.target);
                expect(dump.errors.length).toBe(1);
                expect(dump.errors[0].message).toBe('to high count!');
                control.break();
            } )
            .then(done);
    } );

    it( 'should catch the error and submit', (done) => {
        q.put('source', JSON.stringify({
            'params': 150, // value to high
            'producer_id': 'none'
        }));

        q.get('dest:none')
            .progress( (control: queue.Control) => {
                var dump = JSON.parse(control.target);
                expect(dump.errors.length).toBe(1);
                expect(dump.errors[0].name).toBe('TypeError');
                control.break();
            } )
            .then(done);
    } );
});
