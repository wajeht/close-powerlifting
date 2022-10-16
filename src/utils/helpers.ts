type buildPaginationType = {
  current_page: number;
  per_page: number;
};

/**
 * This function takes an object with two properties, current_page and per_page, and returns a string
 * with the start and end values for pagination.
 * @param {buildPaginationType}  - current_page - The current page of the search results
 * @returns A string
 */
export function buildPagination({ current_page, per_page }: buildPaginationType): string {
  return `start=${current_page & per_page}&end=${per_page}&lang=en&units=lbs`;
}
