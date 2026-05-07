import { getActiveJobs } from '@/lib/jobs';
import ApplyForm from './ApplyForm';

export default async function ApplyPage() {
  const jobs = await getActiveJobs();
  // Only pass id+title to the client — full descriptions don't need to ship.
  const list = jobs.map((j) => ({ id: j.id, title: j.title }));
  return <ApplyForm jobs={list} />;
}
