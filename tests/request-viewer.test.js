import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequest, filterRequestTools } from '../request-viewer.js';

test('request parsing retains message order, settings, and available tool schemas without inventing execution', () => {
 const input = { model:'example', messages:[{role:'system',content:'<rules>Use evidence</rules>'},{role:'user',content:'Hello'}], tools:Array.from({length:78},(_,i)=>({type:'function',function:{name:`tool_${i}`,parameters:{type:'object',properties:{order_id:{type:'string'}},required:['order_id']}}})), max_tokens:0, stream:false, thinking:{type:'enabled'}, stream_options:{include_usage:true} };
 const request=normalizeRequest(input);
 assert.deepEqual(request.messages.map(m=>m.role),['system','user']);
 assert.equal(request.tools.length,78);
 assert.equal(request.settings.max_tokens,0);
 assert.equal(request.settings.stream,false);
 assert.deepEqual(request.tools[0].parameters,input.tools[0].function.parameters);
 assert.equal(request.raw,input);
 assert.equal(request.duration,undefined);
 assert.equal(request.usage,undefined);
 assert.equal(request.steps,undefined);
});
test('tool search includes parameters and has a real empty state',()=>{
 const request=normalizeRequest({messages:[],tools:[{type:'function',function:{name:'lookup',parameters:{properties:{order_id:{type:'string'}}}}}]});
 assert.equal(filterRequestTools(request.tools,'ORDER_ID').length,1);
 assert.equal(filterRequestTools(request.tools,'unknown').length,0);
});
test('execution payloads stay on the existing trace path and message metadata is retained',()=>{
 assert.equal(normalizeRequest({events:[]}),null);
 assert.equal(normalizeRequest(null),null);
 const message={role:'assistant',content:null,tool_calls:[{id:'1',function:{name:'lookup',arguments:'{}'}}]};
 assert.deepEqual(normalizeRequest({messages:[message]}).messages[0].raw,message);
});
