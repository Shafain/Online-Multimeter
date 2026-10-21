import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReading,measure,lineBuffer} from '../dist/model.js';
test('accepts Uno ADC values as integer lines or raw JSON',()=>{assert.equal(parseReading('512\r'),512);assert.equal(parseReading('{"raw":1023}'),1023);assert.equal(parseReading('0'),0);});
test('rejects noise, invalid types, fractional and out-of-range readings',()=>{for(const value of ['','hello','-1','1024','0.5','{"raw":"512"}','{"raw":null}','{bad','5V']) assert.equal(parseReading(value),null);});
test('correct voltage, position and estimated resistance at endpoints',()=>{assert.deepEqual(measure(0,5,10000),{raw:0,voltage:0,percent:0,resistance:0});assert.deepEqual(measure(1023,5,10000),{raw:1023,voltage:5,percent:100,resistance:10000});assert.equal(measure(512,5,10000).voltage,512/1023*5);});
test('reassembles fragmented serial data and CRLF lines',()=>{const values=[];const push=lineBuffer(line=>values.push(parseReading(line)));push('51');push('2\r\n10');push('23\n0\n');assert.deepEqual(values,[512,1023,0]);});
test('discards overlong frames and recovers at next newline',()=>{const values=[];const push=lineBuffer(line=>values.push(parseReading(line)));push('x'.repeat(600));push('512\n42\n');assert.deepEqual(values,[42]);});
