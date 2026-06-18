import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
import { OperatorService } from '../../core/services/operator.service';
import { ServerConnectionService } from '../../core/services/server-connection.service';
import { version } from '../../../../package.json';
import { gitCommit } from '../../../build-info.json';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
// SEM@8e8067ac0f613206ff3fd978a3a11a6565ecff68: display application version, operator info, and open-source attributions
export class AboutComponent implements OnInit {
  operatorName = '';
  operatorContact = '';
  operatorJurisdiction = '';
  webApplicationVersion = '';
  serverVersion = '';
  openSourceProjects = [
    { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
    { name: 'Angular', url: 'https://angular.io/' },
    { name: 'Angular Material', url: 'https://material.angular.io/' },
    { name: 'RxJS', url: 'https://rxjs.dev/' },
    { name: 'Transloco', url: 'https://github.com/jsverse/transloco' },
    { name: 'AntV/X6', url: 'https://x6.antv.vision/en' },
  ];

  otherOpenSourceProjects = [
    {
      nameKey: 'about.opensource.categoryNoteEditing',
      links: [
        { name: 'marked', url: 'https://marked.js.org/' },
        { name: 'mermaid', url: 'https://mermaid.js.org/' },
        { name: 'ngx-markdown', url: 'https://jfcere.github.io/ngx-markdown/' },
        { name: 'prismjs', url: 'https://prismjs.com/' },
      ],
    },
    {
      nameKey: 'about.opensource.categoryInputSanitization',
      links: [{ name: 'dompurify', url: 'https://cure53.de/purify' }],
    },
    {
      nameKey: 'about.opensource.categoryPdfProcessing',
      links: [
        { name: 'pdf-lib', url: 'https://pdf-lib.js.org/' },
        { name: 'fontkit', url: 'https://github.com/foliojs/fontkit' },
      ],
    },
    {
      nameKey: 'cvssCalculator.title',
      links: [
        {
          name: 'ae-cvss-calculator',
          url: 'https://github.com/org-metaeffekt/metaeffekt-universal-cvss-calculator',
        },
      ],
    },
  ];

  fonts = [
    {
      name: 'Roboto',
      links: [
        { name: 'Roboto Condensed', url: 'https://fonts.google.com/specimen/Roboto+Condensed' },
        { name: 'Roboto Mono', url: 'https://fonts.google.com/specimen/Roboto+Mono' },
      ],
    },
    {
      name: 'Noto Sans',
      links: [{ name: 'Noto Sans', url: 'https://fonts.google.com/noto/specimen/Noto+Sans' }],
    },
    {
      name: 'Material Icons Outlined',
      links: [{ name: 'Material Icons Outlined', url: 'https://fonts.google.com/icons' }],
    },
  ];

  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: inject operator, server connection, and navigation services
  constructor(
    private operatorService: OperatorService,
    private serverConnectionService: ServerConnectionService,
    private location: Location,
  ) {}

  // SEM@8e8067ac0f613206ff3fd978a3a11a6565ecff68: populate operator info and version strings from services (reads DB)
  ngOnInit(): void {
    this.operatorName = this.operatorService.getOperatorName();
    this.operatorContact = this.operatorService.getOperatorContact();
    this.operatorJurisdiction = this.operatorService.getOperatorJurisdiction();
    this.webApplicationVersion = `${version} (${gitCommit})`;
    this.serverVersion = this.serverConnectionService.getFormattedServerVersion();
  }

  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: navigate to the previous browser history entry
  goBack(): void {
    this.location.back();
  }
}
