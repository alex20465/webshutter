import {component as com, producer} from '../../src/core';

export namespace testcomp {
    export class ActionComponent extends com.action.Base implements com.action.Interface {
        ROUTE = '/test';
        action() {
            this.response.write('foo');
            this.response.status(200);
            this.response.end();
        }
    }
}

export namespace testcomp2 {
    export class ProcessorComponent extends com.processor.Base implements com.processor.Interface {

        SOURCE = 'test';
        DESTINATION = 'test';

        process() {
            this.finish({});
        }

        restoreJob(dump: any) {
            return new producer.job.Base<any>(dump.id, dump.producer_id, dump.params);
        }
    }
}
