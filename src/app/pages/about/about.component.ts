import { Component, OnInit } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';
import { OperatorService } from '../../core/services/operator.service';

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
  openSourceProjects = [
    { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
    { name: 'Angular', url: 'https://angular.io/' },
    { name: 'AntV/X6', url: 'https://x6.antv.vision/en' },
    { name: 'Transloco', url: 'https://github.com/jsverse/transloco' },
    { name: 'RxJS', url: 'https://rxjs.dev/' },
    { name: 'UUID', url: 'https://github.com/uuidjs/uuid' },
    { name: 'Angular Material', url: 'https://material.angular.io/' },
    { name: 'Roboto', url: 'https://fonts.google.com/specimen/Roboto' },
    { name: 'Roboto Condensed', url: 'https://fonts.google.com/specimen/Roboto+Condensed' },
    { name: 'Material Icons Outlined', url: 'https://fonts.google.com/icons' },
  ];

  constructor(private operatorService: OperatorService) {}

  ngOnInit(): void {
    this.operatorName = this.operatorService.getOperatorName();
    this.operatorContact = this.operatorService.getOperatorContact();
  }
}
