import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule,
    SharedModule
  ],
  providers: [
    // AuthService is automatically provided as it has @Injectable({ providedIn: 'root' })
  ]
})
export class AuthModule { }
