import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LoggerService } from '../../../core/services/logger.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { take } from 'rxjs';

interface UnauthorizedQueryParams {
  requiredRole?: string;
  currentUrl?: string;
  reason?: string;
  statusCode?: string;
}

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, TranslocoPipe],
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss'],
})
export class UnauthorizedComponent implements OnInit {
  requiredRole: string | null = null;
  currentUrl: string | null = null;
  reason: string | null = null;
  statusCode: number = 403; // Default to 403 Forbidden

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe((params: UnauthorizedQueryParams) => {
      this.requiredRole = params.requiredRole || null;
      this.currentUrl = params.currentUrl || null;
      this.reason = params.reason || null;

      // Determine status code from reason or statusCode param
      if (params.statusCode) {
        this.statusCode = parseInt(params.statusCode, 10);
      } else if (params.reason === 'unauthorized_api') {
        this.statusCode = 401;
      }

      this.logger.warn(
        `Unauthorized access attempt. Status: ${this.statusCode}, Required Role: ${this.requiredRole}, Current URL: ${this.currentUrl}, Reason: ${this.reason}`,
      );
    });
  }

  goBack(): void {
    void this.router.navigate(['/']); // Always navigate to home page
  }
}
