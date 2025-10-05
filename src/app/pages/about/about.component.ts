import { Component, OnInit } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';
import { OperatorService } from '../../core/services/operator.service';
import { ServerConnectionService } from '../../core/services/server-connection.service';
import { version } from '../../../../package.json';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [...COMMON_IMPORTS, TranslocoModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements OnInit {
  operatorName = '';
  operatorContact = '';
  operatorJurisdiction = '';
  webApplicationVersion = '';
  serverVersion = '';
  openSourceProjects = [
    { name: 'AntV/X6', url: 'https://x6.antv.vision/en' },
    { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
    { name: 'Angular', url: 'https://angular.io/' },
    { name: 'Angular Material', url: 'https://material.angular.io/' },
    { name: 'RxJS', url: 'https://rxjs.dev/' },
    { name: 'Transloco', url: 'https://github.com/jsverse/transloco' },
    { name: 'Roboto', url: 'https://fonts.google.com/specimen/Roboto' },
    { name: 'Roboto Condensed', url: 'https://fonts.google.com/specimen/Roboto+Condensed' },
    { name: 'Material Icons Outlined', url: 'https://fonts.google.com/icons' },
  ];

  constructor(
    private operatorService: OperatorService,
    private serverConnectionService: ServerConnectionService,
  ) {}

  ngOnInit(): void {
    this.operatorName = this.operatorService.getOperatorName();
    this.operatorContact = this.operatorService.getOperatorContact();
    this.operatorJurisdiction = this.operatorService.getOperatorJurisdiction();
    this.webApplicationVersion = version;
    this.serverVersion = this.serverConnectionService.getServerVersion() || '';
  }
}
