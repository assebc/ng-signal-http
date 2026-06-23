import { Injectable } from '@angular/core';
import { querySignal } from '@assebc/ng-signal-http';
import { User } from '../models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  readonly users = querySignal<User[]>('/users');
}
