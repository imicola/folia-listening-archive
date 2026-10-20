import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCell} from '../src/core/canvas';
test('二维重复画布每格有归属，负坐标合法且可到达完整 100 首',()=>{const reached=new Set<number>();for(let row=-30;row<30;row++)for(let col=-10;col<10;col++){const c=rankCell(row,col,100);assert(c.index>=0&&c.index<100);assert(c.column<=col&&c.column+c.span>col);reached.add(c.index)}assert.equal(reached.size,100)});
