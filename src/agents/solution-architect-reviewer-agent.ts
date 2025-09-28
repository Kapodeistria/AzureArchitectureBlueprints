/**
 * Solution Architect Reviewer Agent
 * Reviews architecture proposals and provides detailed feedback and improvement suggestions
 */

import { BaseAgent } from './base-agent.js';

export interface ReviewFeedback {
  overallScore: number; // 1-10
  approved: boolean;
  criticalIssues: string[];
  improvements: string[];
  strengths: string[];
  detailedFeedback: string;
  improvedArchitecture?: string; // For DSL integration workflow
}

export interface ReviewTask {
  id: string;
  type: 'architecture-review' | 'cost-review';
  priority: 'high' | 'medium' | 'low';
  payload: {
    caseStudyText: string;
    architecture: string;
    requirements: string;
    visualDiagrams?: string;
    researchData?: {
      azureServices: string;
      industryPatterns: string;
      compliance: string;
    };
  };
}

export class SolutionArchitectReviewerAgent extends BaseAgent {
  constructor(client?: any) {
    super('solution-architect-reviewer');
    if (client) {
      this.client = client;
    }
  }

  /**
   * Execute architecture review task - compatible with orchestrator interface
   */
  async execute(task: ReviewTask): Promise<ReviewFeedback & { score: number; feedback: string }> {
    const { caseStudyText, architecture, requirements, visualDiagrams, researchData } = task.payload;
    
    // Use existing review method as the core logic
    const reviewResult = await this.reviewArchitecture(
      caseStudyText,
      requirements, 
      architecture,
      researchData || {
        azureServices: 'Standard Azure services analyzed',
        industryPatterns: 'Industry best practices considered',
        compliance: 'Security and compliance evaluated'
      }
    );

    // If not approved, generate improved architecture
    if (!reviewResult.approved && reviewResult.overallScore < 8) {
      const improvedArchitecture = await this.generateImprovedArchitecture(
        architecture,
        reviewResult,
        caseStudyText,
        requirements
      );
      reviewResult.improvedArchitecture = improvedArchitecture;
    }

    // Return in format expected by orchestrator
    return {
      ...reviewResult,
      score: reviewResult.overallScore,
      feedback: reviewResult.detailedFeedback
    };
  }

  /**
   * Generate improved architecture based on review feedback
   */
  private async generateImprovedArchitecture(
    originalArchitecture: string,
    reviewResult: ReviewFeedback,
    caseStudyText: string,
    requirements: string
  ): Promise<string> {
    const improvementPrompt = `You are a Senior Solution Architect. Based on the review feedback, improve the architecture to address all critical issues and key improvements.

ORIGINAL ARCHITECTURE:
${originalArchitecture}

REVIEW FEEDBACK:
Score: ${reviewResult.overallScore}/10
Critical Issues: ${reviewResult.criticalIssues.join(', ')}
Improvements Needed: ${reviewResult.improvements.join(', ')}
Detailed Feedback: ${reviewResult.detailedFeedback}

CASE STUDY CONTEXT:
${caseStudyText}

REQUIREMENTS:
${requirements}

Please provide an improved architecture that specifically addresses all the critical issues and incorporates the key improvements while maintaining the core architectural vision. Focus on:

1. Resolving all critical issues identified
2. Implementing suggested improvements
3. Maintaining Azure best practices
4. Ensuring DSL compatibility with specific service names and clear relationships
5. Providing concrete technical details and SKUs

Return only the improved architecture description.`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are improving an Azure architecture based on expert review feedback. Focus on addressing specific issues while maintaining architectural integrity.' },
        { role: 'user', content: improvementPrompt }
      ]);

      return response;
    } catch (error) {
      console.error('Failed to generate improved architecture:', error);
      return originalArchitecture; // Fallback to original if improvement fails
    }
  }

  async reviewArchitecture(
    caseStudyText: string, 
    requirements: string,
    architectureDesign: string,
    researchData: {
      azureServices: string;
      industryPatterns: string;
      compliance: string;
    }
  ): Promise<ReviewFeedback> {
    const reviewPrompt = `As a Senior Solution Architect with 15+ years of enterprise architecture experience, conduct a thorough technical review of this architecture proposal.

ORIGINAL CASE STUDY:
${caseStudyText}

REQUIREMENTS ANALYSIS:
${requirements}

PROPOSED ARCHITECTURE:
${architectureDesign}

RESEARCH CONTEXT:
Azure Services Research: ${researchData.azureServices}
Industry Patterns: ${researchData.industryPatterns}
Compliance Research: ${researchData.compliance}

Conduct a comprehensive architecture review covering:

## Technical Review Criteria

### 1. Requirements Alignment (Weight: 25%)
- Does the architecture address ALL functional requirements?
- Are non-functional requirements (performance, scalability, security) properly addressed?
- Any missing requirements not covered?

### 2. Architecture Quality (Weight: 25%)
- Are appropriate design patterns used?
- Is the architecture well-structured and maintainable?
- Are there any architectural debt concerns?
- Proper separation of concerns?

### 3. Technology Choices (Weight: 20%)
- Are the Azure services appropriate for the use case?
- Are there better service alternatives based on the research?
- Is the technology stack cohesive?
- Future-proofing considerations?

### 4. Scalability & Performance (Weight: 15%)
- Can the architecture handle the expected load?
- Are there potential bottlenecks?
- Auto-scaling properly designed?
- Caching strategies appropriate?

### 5. Security & Compliance (Weight: 10%)
- Security best practices followed?
- Compliance requirements addressed?
- Data protection measures adequate?
- Network security properly designed?

### 6. Operational Excellence (Weight: 5%)
- Monitoring and observability?
- Deployment and CI/CD considerations?
- Disaster recovery planning?
- Cost optimization opportunities?

## Review Output Format

Provide your review in this JSON format:
{
  "overallScore": [1-10],
  "approved": [true/false],
  "criticalIssues": [
    "Issue 1: Description and impact",
    "Issue 2: Description and impact"
  ],
  "improvements": [
    "Improvement 1: Specific suggestion with rationale",
    "Improvement 2: Specific suggestion with rationale"
  ],
  "strengths": [
    "Strength 1: What was done well",
    "Strength 2: What was done well"
  ],
  "detailedFeedback": "Comprehensive written feedback with specific recommendations for each section above. Include alternative approaches where applicable."
}

IMPORTANT: 
- Be thorough but constructive
- Only approve (true) if score is 8+ and no critical issues
- Critical issues are those that would cause production failures or major business impact
- Improvements are enhancements that would make the solution better
- Provide specific, actionable feedback`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are a highly experienced Senior Solution Architect known for thorough, constructive technical reviews. Your feedback helps teams build better enterprise solutions.' },
        { role: 'user', content: reviewPrompt }
      ]);

      // Parse JSON response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as ReviewFeedback;
        }
      } catch (parseError) {
        // Fallback if JSON parsing fails
      }

      // Fallback structured response
      return {
        overallScore: 6,
        approved: false,
        criticalIssues: ['Unable to parse detailed review - please check response format'],
        improvements: ['Review response format needs improvement'],
        strengths: ['Architecture review was attempted'],
        detailedFeedback: response
      };
    } catch (error) {
      return {
        overallScore: 1,
        approved: false,
        criticalIssues: [`Review failed: ${error instanceof Error ? error.message : String(error)}`],
        improvements: ['Fix review system technical issues'],
        strengths: [],
        detailedFeedback: 'Technical error occurred during review process'
      };
    }
  }

  async reviewCostOptimization(
    originalArchitecture: string,
    costOptimizedArchitecture: string,
    costAnalysis: string
  ): Promise<ReviewFeedback> {
    const costReviewPrompt = `Review this cost optimization proposal:

ORIGINAL ARCHITECTURE:
${originalArchitecture}

COST-OPTIMIZED ARCHITECTURE:
${costOptimizedArchitecture}

COST ANALYSIS:
${costAnalysis}

Evaluate:
1. Are the cost optimizations technically sound?
2. Do they maintain the required functionality and performance?
3. Are there any risks introduced by the cost optimizations?
4. Are there better cost optimization opportunities missed?

Respond in the same JSON format as the main architecture review.`;

    try {
      const response = await this.callOpenAI([
        { role: 'system', content: 'You are reviewing cost optimization proposals for their technical soundness and risk assessment.' },
        { role: 'user', content: costReviewPrompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ReviewFeedback;
      }

      return {
        overallScore: 6,
        approved: false,
        criticalIssues: ['Unable to parse cost review'],
        improvements: ['Improve cost review format'],
        strengths: ['Cost optimization attempted'],
        detailedFeedback: response
      };
    } catch (error) {
      return {
        overallScore: 1,
        approved: false,
        criticalIssues: [`Cost review failed: ${error instanceof Error ? error.message : String(error)}`],
        improvements: [],
        strengths: [],
        detailedFeedback: 'Cost review technical error'
      };
    }
  }
}