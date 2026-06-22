import { Component, inject } from '@angular/core';
import { PostsService } from './posts.service';

@Component({
  standalone: true,
  selector: 'app-posts-list',
  template: `
    <div class="page-header">
      <h2>Posts</h2>
    </div>

    @if (posts.loading()) {
      <p class="status-loading">Fetching posts…</p>
    }

    @if (posts.error(); as err) {
      <p class="status-error">{{ err.message }}</p>
    }

    @for (post of (posts.data() ?? []).slice(0, 15); track post.id) {
      <div class="card post-card">
        <span class="post-id">#{{ post.id }}</span>
        <div class="post-content">
          <strong class="post-title">{{ post.title }}</strong>
          <p class="post-body">{{ post.body }}</p>
        </div>
      </div>
    }

    @if (posts.data(); as list) {
      <p class="hint">Showing 15 of {{ list.length }}</p>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    h2 { margin: 0; }
    .hint { font-size: 0.75rem; color: #9ca3af; margin: 0.75rem 0 0; }
    .post-card { display: flex; gap: 1rem; align-items: flex-start; }
    .post-id { color: #9ca3af; font-size: 0.75rem; min-width: 28px; padding-top: 2px; }
    .post-content { flex: 1; min-width: 0; }
    .post-title { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .post-body { margin: 0; font-size: 0.8rem; color: #6b7280; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  `],
})
export class PostsListComponent {
  protected readonly posts = inject(PostsService).posts;
}
