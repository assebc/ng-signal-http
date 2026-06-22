import { Injectable } from '@angular/core';
import { querySignal } from 'ng-signal-http';
import { Post } from '../models';

@Injectable({ providedIn: 'root' })
export class PostsService {
  readonly posts = querySignal<Post[]>('/posts');
}
