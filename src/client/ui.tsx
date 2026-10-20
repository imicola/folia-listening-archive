import React from 'react';
import type {ArchiveService} from '../core/model';
import type {Theme} from './host';
import {ArtworkProvider} from './artwork';
import {DenseArchive} from './dense';
export function App(props:{service:ArchiveService;theme:Theme;preview?:boolean}){
 return <div className="archive-source-root"><ArtworkProvider service={props.service}><DenseArchive {...props}/></ArtworkProvider></div>;
}
