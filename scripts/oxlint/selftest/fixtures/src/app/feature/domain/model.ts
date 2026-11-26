import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { Repo } from '../services/repo';
import { ProbeService } from '@app/shared/probe.service';
import { Cell } from '@antv/x6/lib/model/cell';
import { Deep } from '../infrastructure/adapters/deep';
import { Common } from '@angular/common';
import { Observable } from 'rxjs';
import { Translate } from '@jsverse/transloco';
import { Infra } from '../../infrastructure/x';
import { App } from '../application/x';
import { App2 } from '../../application/x';

export const model = [
  Injectable,
  MatDialog,
  map,
  Graph,
  Repo,
  ProbeService,
  Cell,
  Deep,
  Common,
  Observable,
  Translate,
  Infra,
  App,
  App2,
];
