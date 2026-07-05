import { mockData, verifyMockData } from "../packages/mock-data/src/index.js";

const report = verifyMockData(mockData);

console.log("Mock 数据校验通过");
console.table(report.counts);
