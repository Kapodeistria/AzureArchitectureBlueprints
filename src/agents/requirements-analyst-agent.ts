/**
 * Requirements Analyst Agent
 * Extracts and categorizes comprehensive requirements from case studies
 */

import OpenAI from 'openai';

export class RequirementsAnalystAgent {
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async analyze(caseStudyText: string): Promise<string> {
    const systemPrompt = `You are a Requirements Analyst Agent specialized in extracting and categorizing requirements from case studies. 

Return your response in this exact format:

FUNCTIONAL REQUIREMENTS:
- [requirement 1]
- [requirement 2]
...

NON-FUNCTIONAL REQUIREMENTS:
- [requirement 1] 
- [requirement 2]
...

CONSTRAINTS:
- [constraint 1]
- [constraint 2]
...

Be thorough and specific. Consider implicit requirements based on context.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this case study and extract all requirements:\n\n${caseStudyText}` }
      ],
      max_tokens: 1200,
      temperature: 0.2
    });

    return response.choices[0]?.message?.content || '';
  }
}