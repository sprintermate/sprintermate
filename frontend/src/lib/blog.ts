import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  contentHtml?: string;
}

function getPostsDirectory(locale: string): string {
  return path.join(process.cwd(), 'content', 'blog', locale);
}

export function getAllPosts(locale: string): BlogPost[] {
  const dir = getPostsDirectory(locale);

  if (!fs.existsSync(dir)) return [];

  const filenames = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));

  const posts = filenames.map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const fullPath = path.join(dir, filename);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);

    return {
      slug,
      title: data.title as string,
      description: data.description as string,
      date: data.date as string,
      author: data.author as string,
      tags: (data.tags as string[]) ?? [],
    };
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(
  locale: string,
  slug: string,
): Promise<BlogPost | null> {
  const fullPath = path.join(getPostsDirectory(locale), `${slug}.md`);

  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  const processed = await remark().use(remarkHtml).process(content);
  const contentHtml = processed.toString();

  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    date: data.date as string,
    author: data.author as string,
    tags: (data.tags as string[]) ?? [],
    contentHtml,
  };
}

export function getAllSlugs(locale: string): string[] {
  const dir = getPostsDirectory(locale);

  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}
