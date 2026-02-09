import express from 'express';
import dotenv from 'dotenv';
import { matchQuestionsToKazanim } from './services/kazanim-matcher.js';
import { parseTestXml } from './services/xml-parser.js';
import { saveMatchResults, updateActivityResults } from './services/database.js';
import { getActivitiesFromElastic } from './services/elasticsearch.js';
import { matchActivitiesToKazanim } from './services/activity-matcher.js';
import { searchKazanimlar } from './services/kazanim-search.js';
import { searchDisKazanimlar } from './services/dis-kazanim-search.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/match-kazanim', async (req, res) => {
  try {
    const { dersId, questions } = req.body;

    // Validation
    if (!dersId) {
      return res.status(400).json({ 
        error: 'dersId is required' 
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        error: 'questions array is required and must not be empty' 
      });
    }

    // Validate question structure
    for (const question of questions) {
      if (!question.id || !question.text) {
        return res.status(400).json({ 
          error: 'Each question must have id and text properties' 
        });
      }
    }

    // Process matching
    const result = await matchQuestionsToKazanim(dersId, questions);

    res.json(result);

  } catch (error) {
    console.error('Error in /api/match-kazanim:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/match-kazanim-from-xml', async (req, res) => {
  try {
    const { dersId, testXmlPath, testSira, save, kitapId, testId } = req.body;

    // Validation
    if (!dersId) {
      return res.status(400).json({ 
        error: 'dersId is required' 
      });
    }

    if (!testXmlPath) {
      return res.status(400).json({ 
        error: 'testXmlPath is required (file path or HTTP URL)' 
      });
    }

    if (testSira === undefined || testSira === null) {
      return res.status(400).json({ 
        error: 'testSira is required (test ID to match)' 
      });
    }

    // Validate save parameters
    if (save === true) {
      if (!kitapId) {
        return res.status(400).json({ 
          error: 'kitapId is required when save is true' 
        });
      }
      if (!testId) {
        return res.status(400).json({ 
          error: 'testId is required when save is true' 
        });
      }
    }

    // Parse XML and extract questions
    console.log(`Parsing XML from: ${testXmlPath}`);
    console.log(`Looking for test with ID: ${testSira}`);
    
    const questions = await parseTestXml(testXmlPath, testSira);
    
    console.log(`Found ${questions.length} questions in test ${testSira}`);

    // Process matching
    const matchResults = await matchQuestionsToKazanim(dersId, questions);

    // Save to database if requested
    if (save === true) {
      console.log(`Saving results to database (KitapId: ${kitapId}, TestId: ${testId})`);
      
      const saveResults = await saveMatchResults(matchResults, kitapId, testId);
      
      const savedCount = saveResults.filter(r => r.saved).length;
      const skippedCount = saveResults.filter(r => r.skipped).length;
      const errorCount = saveResults.filter(r => !r.saved && !r.skipped).length;

      console.log(`Save summary: ${savedCount} saved, ${skippedCount} skipped, ${errorCount} errors`);

      return res.json({
        matchResults,
        saveResults,
        summary: {
          total: saveResults.length,
          saved: savedCount,
          skipped: skippedCount,
          errors: errorCount,
        },
      });
    }

    // Return only match results if save is false
    res.json(matchResults);

  } catch (error) {
    console.error('Error in /api/match-kazanim-from-xml:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/match-activities', async (req, res) => {
  try {
    const { bookId, activities } = req.body;

    // Validation
    if (!bookId) {
      return res.status(400).json({ 
        error: 'bookId is required' 
      });
    }

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ 
        error: 'activities array is required and must not be empty' 
      });
    }

    // Validate activities structure
    for (const activity of activities) {
      if (!activity.dersId) {
        return res.status(400).json({ 
          error: 'Each activity must have dersId property' 
        });
      }
      if (activity.activityIndex === undefined || activity.activityIndex === null) {
        return res.status(400).json({ 
          error: 'Each activity must have activityIndex property' 
        });
      }
      if (!activity.etkinlikId) {
        return res.status(400).json({ 
          error: 'Each activity must have etkinlikId property' 
        });
      }
    }

    console.log(`Processing ${activities.length} activities for BookId: ${bookId}`);

    const allResults = [];

    // Process each activity
    for (const activity of activities) {
      try {
        const { dersId, activityIndex, etkinlikId } = activity;

        console.log(`\n--- Processing DersId: ${dersId}, ActivityIndex: ${activityIndex}, EtkinlikId: ${etkinlikId} ---`);

        // Fetch activities from Elasticsearch
        console.log(`Fetching activities from Elasticsearch (BookId: ${bookId}, ActivityIndex: ${activityIndex})`);
        
        const elasticActivities = await getActivitiesFromElastic(bookId, activityIndex);
        
        console.log(`Found ${elasticActivities.length} activities`);

        // Process matching
        const matchResults = await matchActivitiesToKazanim(dersId, elasticActivities);

        // Update database
        console.log(`Updating database (EtkinlikId: ${etkinlikId})`);
        
        const updateResults = await updateActivityResults(matchResults, etkinlikId);
        
        const updatedCount = updateResults.filter(r => r.updated).length;
        const errorCount = updateResults.filter(r => !r.updated).length;

        console.log(`Update summary: ${updatedCount} updated, ${errorCount} errors`);

        allResults.push({
          dersId,
          activityIndex,
          etkinlikId,
          matchResults,
          updateResults,
          summary: {
            total: updateResults.length,
            updated: updatedCount,
            errors: errorCount,
          },
        });

      } catch (error) {
        console.error(`Error processing activity ${activity.activityIndex}:`, error);
        allResults.push({
          dersId: activity.dersId,
          activityIndex: activity.activityIndex,
          etkinlikId: activity.etkinlikId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate overall summary
    const overallSummary = {
      totalActivities: activities.length,
      successfulActivities: allResults.filter(r => !r.error).length,
      failedActivities: allResults.filter(r => r.error).length,
      totalUpdated: allResults
        .filter(r => r.summary)
        .reduce((sum, r) => sum + r.summary.updated, 0),
      totalErrors: allResults
        .filter(r => r.summary)
        .reduce((sum, r) => sum + r.summary.errors, 0),
    };

    console.log(`\n=== Overall Summary ===`);
    console.log(`Total Activities: ${overallSummary.totalActivities}`);
    console.log(`Successful: ${overallSummary.successfulActivities}`);
    console.log(`Failed: ${overallSummary.failedActivities}`);
    console.log(`Total Updated: ${overallSummary.totalUpdated}`);
    console.log(`Total Errors: ${overallSummary.totalErrors}`);

    res.json({
      results: allResults,
      overallSummary,
    });

  } catch (error) {
    console.error('Error in /api/match-activities:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/search-kazanim', async (req, res) => {
  try {
    const { dersId, queries, topK } = req.body;

    // Validation
    if (!dersId) {
      return res.status(400).json({ 
        error: 'dersId is required' 
      });
    }

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ 
        error: 'queries array is required and must not be empty' 
      });
    }

    // Validate queries structure
    for (const query of queries) {
      if (!query.id) {
        return res.status(400).json({ 
          error: 'Each query must have id property' 
        });
      }
      if (!query.text) {
        return res.status(400).json({ 
          error: 'Each query must have text property' 
        });
      }
    }

    // Set default topK if not provided
    const resultCount = topK && topK > 0 ? topK : 5;

    console.log(`Searching ${queries.length} queries for DersId: ${dersId}, TopK: ${resultCount}`);

    // Process search
    const results = await searchKazanimlar(dersId, queries, resultCount);

    res.json({
      results,
      summary: {
        totalQueries: queries.length,
        topK: resultCount,
      },
    });

  } catch (error) {
    console.error('Error in /api/search-kazanim:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/search-kazanim-dis', async (req, res) => {
  try {
    const { dersId, queries, topK } = req.body;

    // Validation
    if (!dersId) {
      return res.status(400).json({ 
        error: 'dersId is required' 
      });
    }

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ 
        error: 'queries array is required and must not be empty' 
      });
    }

    // Validate queries structure
    for (const query of queries) {
      if (!query.id) {
        return res.status(400).json({ 
          error: 'Each query must have id property' 
        });
      }
      if (!query.text) {
        return res.status(400).json({ 
          error: 'Each query must have text property' 
        });
      }
    }

    // Set default topK if not provided
    const resultCount = topK && topK > 0 ? topK : 5;

    console.log(`Searching ${queries.length} queries for DersId: ${dersId}, TopK: ${resultCount} (Dis Kazanimlar)`);

    // Process search
    const results = await searchDisKazanimlar(dersId, queries, resultCount);

    res.json({
      results,
      summary: {
        totalQueries: queries.length,
        topK: resultCount,
      },
    });

  } catch (error) {
    console.error('Error in /api/search-kazanim-dis:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Match endpoint: POST http://localhost:${PORT}/api/match-kazanim`);
  console.log(`Match from XML: POST http://localhost:${PORT}/api/match-kazanim-from-xml`);
  console.log(`Match activities: POST http://localhost:${PORT}/api/match-activities`);
  console.log(`Search kazanim: POST http://localhost:${PORT}/api/search-kazanim`);
  console.log(`Search dis kazanim: POST http://localhost:${PORT}/api/search-kazanim-dis`);
});
