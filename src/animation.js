// Only one animation may own a page. Replays must stop an in-flight fade.
export function cancelPageJobs(jobs, side) {
  return jobs.filter(job => {
    if (job.side !== side) return true;
    job.resolve(false);
    return false;
  });
}
