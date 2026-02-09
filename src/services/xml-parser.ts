import { XMLParser } from 'fast-xml-parser';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

interface XmlItem {
  soruNo: string | number;
  question_content: string;
  testId: string | number;
  cevap?: string;
  page?: string | number;
  rect?: string;
  soruNoCoordinates?: string;
  secenekler?: any;
}

interface XmlTest {
  ID: string | number;
  ADI?: string;
  BaslangicSayfasi?: string | number;
  BitisSayfasi?: string | number;
  SECENEKSAYISI?: string | number;
  testCerceve?: string;
  BASARIORANI?: string | number;
  item: XmlItem | XmlItem[];
}

interface XmlTestler {
  SECENEK?: string;
  SECENEKYARICAP?: string | number;
  TEKRARAC?: string;
  test: XmlTest | XmlTest[];
}

interface ParsedXml {
  testler: XmlTestler;
}

export interface Question {
  id: number | string;
  text: string;
}

async function fetchXmlContent(xmlPath: string): Promise<string> {
  // Check if it's a URL
  if (xmlPath.startsWith('http://') || xmlPath.startsWith('https://')) {
    try {
      const response = await axios.get(xmlPath, {
        responseType: 'text',
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch XML from URL: ${xmlPath}`);
    }
  }
  
  // It's a file path
  try {
    const content = await fs.readFile(xmlPath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read XML file: ${xmlPath}`);
  }
}

export async function parseTestXml(
  xmlPath: string,
  testSira: number
): Promise<Question[]> {
  // Fetch XML content
  const xmlContent = await fetchXmlContent(xmlPath);

  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
  });

  const parsed: ParsedXml = parser.parse(xmlContent);

  if (!parsed.testler) {
    throw new Error('Invalid XML structure: missing <testler> root element');
  }

  // Normalize tests to array
  let tests: XmlTest[] = [];
  if (Array.isArray(parsed.testler.test)) {
    tests = parsed.testler.test;
  } else if (parsed.testler.test) {
    tests = [parsed.testler.test];
  } else {
    throw new Error('No <test> elements found in XML');
  }

  // Find the test with matching ID
  const targetTest = tests.find(t => {
    const testId = typeof t.ID === 'string' ? parseInt(t.ID) : t.ID;
    return testId === testSira;
  });

  if (!targetTest) {
    throw new Error(`Test with ID ${testSira} not found in XML`);
  }

  // Normalize items to array
  let items: XmlItem[] = [];
  if (Array.isArray(targetTest.item)) {
    items = targetTest.item;
  } else if (targetTest.item) {
    items = [targetTest.item];
  } else {
    throw new Error(`No items found in test with ID ${testSira}`);
  }

  // Extract questions
  const questions: Question[] = items
    .filter(item => item.question_content && item.soruNo)
    .map(item => ({
      id: typeof item.soruNo === 'string' ? parseInt(item.soruNo) : item.soruNo,
      text: item.question_content.trim(),
    }));

  if (questions.length === 0) {
    throw new Error(`No valid questions found in test with ID ${testSira}`);
  }

  return questions;
}
