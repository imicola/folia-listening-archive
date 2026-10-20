export function rankCell(row:number,column:number,count:number){const band=Math.floor(column/5),col=((column%5)+5)%5;
 const wide=row%2===0?0:2;const slot=col<wide?col:col===wide||col===wide+1?wide:col-1;
 const index=((row*4+band*4+slot)%count+count)%count;
 return {index,column:band*5+(slot<wide?slot:slot===wide?wide:slot+1),span:slot===wide?2:1};
}
