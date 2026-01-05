import type { ScraperType } from "../../../context";
import { NotFoundError, ValidationError } from "../../../error";
import type { RecordCategory, ApiResponse } from "../../../types";
import {
  recordsEquipmentEnum,
  recordsWeightClassEnum,
  recordsSexEnum,
  type GetRecordsType,
  type GetFilteredRecordsParamType,
  type GetFilteredRecordsQueryType,
} from "./records.validation";

export function createRecordService(scraper: ScraperType) {
  function parseRecordsHtml(doc: Document): RecordCategory[] {
    const recordCols = doc.getElementsByClassName("records-col");
    const data: RecordCategory[] = [];

    for (const col of recordCols) {
      const heading = col.querySelector("h2, h3");
      const table = col.querySelector("table");

      if (heading && table) {
        data.push({
          title: heading.textContent?.trim() || "",
          records: scraper.tableToJson<Record<string, string>>(table),
        });
      }
    }

    return data;
  }

  async function fetchRecordsData(filterPath: string = ""): Promise<RecordCategory[]> {
    const html = await scraper.fetchHtml(`/records${filterPath}`);
    const doc = scraper.parseHtml(html);
    return parseRecordsHtml(doc);
  }

  async function getRecords(_options: GetRecordsType): Promise<ApiResponse<RecordCategory[]>> {
    return scraper.withCache<RecordCategory[]>("records", () => fetchRecordsData());
  }

  function buildRecordsFilterPath(filters: GetFilteredRecordsParamType): string {
    const parts: string[] = [];
    if (filters.equipment) parts.push(filters.equipment);
    if (filters.weight_class) parts.push(filters.weight_class);
    if (filters.sex) parts.push(filters.sex);
    return parts.length > 0 ? `/${parts.join("/")}` : "";
  }

  function validateEquipment(equipment: string): GetFilteredRecordsParamType["equipment"] {
    const result = recordsEquipmentEnum.safeParse(equipment);
    if (!result.success) {
      throw new ValidationError("Invalid equipment parameter!");
    }
    return result.data;
  }

  function parseSexOrWeightClass(
    equipment: string,
    sexOrWeightClass: string,
  ): GetFilteredRecordsParamType {
    const validEquipment = validateEquipment(equipment);

    const sexResult = recordsSexEnum.safeParse(sexOrWeightClass);
    if (sexResult.success) {
      return { equipment: validEquipment, sex: sexResult.data };
    }

    const weightClassResult = recordsWeightClassEnum.safeParse(sexOrWeightClass);
    if (weightClassResult.success) {
      return { equipment: validEquipment, weight_class: weightClassResult.data };
    }

    throw new NotFoundError("Invalid sex or weight class parameter!");
  }

  async function getFilteredRecords(
    filters: GetFilteredRecordsParamType,
    _query: GetFilteredRecordsQueryType,
  ): Promise<ApiResponse<RecordCategory[]>> {
    const filterPath = buildRecordsFilterPath(filters);
    const cacheKey = `records${filterPath}`;

    return scraper.withCache<RecordCategory[]>(cacheKey, () => fetchRecordsData(filterPath));
  }

  return {
    parseRecordsHtml,
    getRecords,
    getFilteredRecords,
    parseSexOrWeightClass,
  };
}
