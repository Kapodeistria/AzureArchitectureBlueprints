/**
 * Structurizr DSL Agent Test Suite
 * Comprehensive tests to prevent vibe coding regressions
 */

import { StructurizrDSLAgent } from '../agents/structurizr-dsl-agent.js';
import OpenAI from 'openai';

interface TestCase {
  name: string;
  description: string;
  input: any;
  expectedOutputPatterns: string[];
  expectedDSLElements: string[];
  shouldFail?: boolean;
  timeout?: number;
}

class StructurizrDSLAgentTester {
  private agent: StructurizrDSLAgent;
  private testResults: Map<string, { passed: boolean; error?: string; output?: string }>;

  constructor() {
    // Mock OpenAI client for testing
    const mockClient = {
      chat: {
        completions: {
          create: async (params: any) => ({
            choices: [{
              message: {
                content: this.generateMockDSL(params.messages[1].content)
              }
            }]
          })
        }
      }
    } as any;

    this.agent = new StructurizrDSLAgent(mockClient);
    this.testResults = new Map();
  }

  private generateMockDSL(prompt: string): string {
    // Generate different DSL based on prompt content
    if (prompt.includes('system landscape') || prompt.includes('SystemLandscape')) {
      return `\`\`\`structurizr
workspace "E-commerce Platform" "System landscape for e-commerce solution" {
    model {
        customer = person "Customer" "Uses the e-commerce platform"
        
        ecommerceSystem = softwareSystem "E-commerce Platform" "Online shopping platform" {
            webApp = container "Web Application" "React SPA" "React, TypeScript"
            api = container "API Gateway" "REST API" "Node.js, Express"
            database = container "Database" "Customer and order data" "PostgreSQL"
        }
        
        paymentSystem = softwareSystem "Payment System" "External payment processing" {
            tags "External System"
        }
        
        customer -> ecommerceSystem "Uses"
        ecommerceSystem -> paymentSystem "Processes payments using"
        webApp -> api "Makes API calls to"
        api -> database "Reads from and writes to"
    }
    
    views {
        systemLandscape "SystemLandscape" {
            include *
            autolayout lr
        }
        
        systemContext ecommerceSystem "SystemContext" {
            include *
            autolayout lr
        }
        
        container ecommerceSystem "Containers" {
            include *
            autolayout lr
        }
    }
    
    configuration {
        scope softwaresystem
    }
}
\`\`\``;
    } else if (prompt.includes('container diagram') || prompt.includes('Container')) {
      return `\`\`\`structurizr
workspace "Microservices Architecture" "Container diagram for microservices" {
    model {
        user = person "User" "Application user"
        
        system = softwareSystem "Microservices Platform" {
            apiGateway = container "API Gateway" "Entry point" "Kong, Nginx"
            userService = container "User Service" "User management" "Java, Spring Boot"
            orderService = container "Order Service" "Order processing" "Node.js, Express"
            database = container "Database" "Data storage" "MongoDB"
        }
        
        user -> apiGateway "Makes requests to"
        apiGateway -> userService "Routes user requests to"
        apiGateway -> orderService "Routes order requests to"
        userService -> database "Stores user data in"
        orderService -> database "Stores order data in"
    }
    
    views {
        container system "ContainerView" {
            include *
            autolayout lr
        }
    }
}
\`\`\``;
    } else {
      return `\`\`\`structurizr
workspace "Default Architecture" "Basic architecture diagram" {
    model {
        user = person "User"
        system = softwareSystem "System" {
            app = container "Application"
        }
        user -> system "Uses"
    }
    views {
        systemContext system {
            include *
            autolayout
        }
    }
}
\`\`\``;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Running Structurizr DSL Agent Test Suite...\n');

    const testCases: TestCase[] = [
      {
        name: 'SystemLandscape_BasicEcommerce',
        description: 'Generate system landscape for e-commerce platform',
        input: {
          architecture: {
            type: 'system-landscape',
            systems: [
              { name: 'E-commerce Platform', type: 'software-system', description: 'Main platform' },
              { name: 'Payment System', type: 'external-system', description: 'Payment processing' }
            ]
          },
          requirements: 'Create a system landscape for an e-commerce platform with payment integration',
          components: [],
          relationships: [],
          level: 'system',
          includeViews: true,
          styling: true
        },
        expectedOutputPatterns: [
          'workspace',
          'model',
          'views',
          'systemLandscape',
          'person',
          'softwareSystem'
        ],
        expectedDSLElements: [
          'workspace "',
          'model {',
          'views {',
          'systemLandscape',
          'person "',
          'softwareSystem "'
        ]
      },
      {
        name: 'ContainerDiagram_Microservices',
        description: 'Generate container diagram for microservices architecture',
        input: {
          architecture: {
            type: 'container',
            containers: [
              { name: 'API Gateway', type: 'container', technology: 'Kong' },
              { name: 'User Service', type: 'service', technology: 'Java Spring Boot' },
              { name: 'Database', type: 'database', technology: 'MongoDB' }
            ]
          },
          requirements: 'Create container diagram for microservices with API gateway pattern',
          components: [],
          relationships: [],
          level: 'container',
          includeViews: true,
          styling: true
        },
        expectedOutputPatterns: [
          'container "',
          'API Gateway',
          'User Service',
          'Database'
        ],
        expectedDSLElements: [
          'container "API Gateway"',
          'container "User Service"',
          'container "Database"'
        ]
      },
      {
        name: 'ComponentDiagram_ServiceBreakdown',
        description: 'Generate component diagram for service breakdown',
        input: {
          architecture: {
            type: 'component',
            components: [
              { name: 'User Controller', type: 'component', technology: 'Spring MVC' },
              { name: 'User Repository', type: 'component', technology: 'JPA' },
              { name: 'Authentication Service', type: 'component', technology: 'JWT' }
            ]
          },
          requirements: 'Create component diagram for user service internal structure',
          components: [],
          relationships: [],
          level: 'component',
          includeViews: true,
          styling: false
        },
        expectedOutputPatterns: [
          'component "',
          'User Controller',
          'User Repository',
          'Authentication Service'
        ],
        expectedDSLElements: [
          'component "User Controller"',
          'component "User Repository"',
          'component "Authentication Service"'
        ]
      },
      {
        name: 'DSLValidation_RequiredElements',
        description: 'Validate DSL contains all required structural elements',
        input: {
          architecture: { type: 'system' },
          requirements: 'Simple system with user and application',
          components: [{ name: 'App', type: 'system' }],
          relationships: [],
          level: 'system',
          includeViews: true,
          styling: true
        },
        expectedOutputPatterns: [
          'workspace',
          '{',
          '}',
          'model',
          'views'
        ],
        expectedDSLElements: [
          'workspace "',
          'model {',
          'views {',
          '}'
        ]
      },
      {
        name: 'RelationshipMapping_DirectionalFlow',
        description: 'Test relationship mapping and directional flow',
        input: {
          architecture: {
            type: 'container',
            containers: [
              { name: 'Frontend', type: 'spa' },
              { name: 'API', type: 'service' },
              { name: 'Database', type: 'database' }
            ]
          },
          requirements: 'Map relationships between frontend, API, and database',
          components: [],
          relationships: [
            { from: 'Frontend', to: 'API', description: 'Makes API calls to' },
            { from: 'API', to: 'Database', description: 'Queries' }
          ],
          level: 'container',
          includeViews: true,
          styling: true
        },
        expectedOutputPatterns: [
          '->',
          'Frontend',
          'API',
          'Database',
          'Makes API calls to',
          'Queries'
        ],
        expectedDSLElements: [
          '-> ',
          '"Makes API calls to"',
          '"Queries"'
        ]
      }
    ];

    let passedTests = 0;
    let totalTests = testCases.length;

    for (const testCase of testCases) {
      try {
        console.log(`🔍 Running test: ${testCase.name}`);
        console.log(`📝 Description: ${testCase.description}`);

        const startTime = Date.now();
        const result = await this.agent.generateFullArchitecture(
          testCase.input.architecture,
          testCase.input.requirements
        );
        const executionTime = Date.now() - startTime;

        console.log(`⏱️  Execution time: ${executionTime}ms`);

        // Validate output patterns
        const patternResults = this.validatePatterns(result, testCase.expectedOutputPatterns);
        const elementResults = this.validateDSLElements(result, testCase.expectedDSLElements);
        const syntaxResults = await this.agent.validateDSL(result);

        const allPassed = patternResults.allMatched && 
                         elementResults.allMatched && 
                         syntaxResults.valid;

        if (allPassed) {
          console.log(`✅ PASSED: ${testCase.name}`);
          passedTests++;
        } else {
          console.log(`❌ FAILED: ${testCase.name}`);
          if (!patternResults.allMatched) {
            console.log(`   Missing patterns: ${patternResults.missing.join(', ')}`);
          }
          if (!elementResults.allMatched) {
            console.log(`   Missing DSL elements: ${elementResults.missing.join(', ')}`);
          }
          if (!syntaxResults.valid) {
            console.log(`   Syntax errors: ${syntaxResults.errors.join(', ')}`);
          }
        }

        this.testResults.set(testCase.name, {
          passed: allPassed,
          output: result,
          error: allPassed ? undefined : 'Pattern or syntax validation failed'
        });

      } catch (error) {
        console.log(`❌ ERROR: ${testCase.name} - ${error instanceof Error ? error.message : String(error)}`);
        this.testResults.set(testCase.name, {
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('📊 Test Results Summary:');
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! The Structurizr DSL Agent is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
    }
  }

  private validatePatterns(output: string, patterns: string[]): { allMatched: boolean; missing: string[] } {
    const missing = patterns.filter(pattern => !output.includes(pattern));
    return {
      allMatched: missing.length === 0,
      missing
    };
  }

  private validateDSLElements(output: string, elements: string[]): { allMatched: boolean; missing: string[] } {
    const missing = elements.filter(element => !output.includes(element));
    return {
      allMatched: missing.length === 0,
      missing
    };
  }

  getTestResults(): Map<string, { passed: boolean; error?: string; output?: string }> {
    return this.testResults;
  }

  async runRegressionTests(): Promise<boolean> {
    console.log('🔄 Running regression tests to prevent vibe coding issues...\n');

    // Test for common vibe coding regressions
    const regressionTests = [
      {
        name: 'DSL_Syntax_Consistency',
        test: async () => {
          const result = await this.agent.generateSystemLandscape(
            'Simple e-commerce system',
            [{ name: 'Shop', type: 'web-app' }]
          );
          const validation = await this.agent.validateDSL(result);
          return validation.valid;
        }
      },
      {
        name: 'Required_Elements_Present',
        test: async () => {
          const result = await this.agent.generateContainerDiagram(
            { name: 'Test System' },
            [{ name: 'Web App', type: 'spa' }]
          );
          return result.includes('workspace') && 
                 result.includes('model') && 
                 result.includes('views');
        }
      },
      {
        name: 'Relationship_Direction_Consistency',
        test: async () => {
          const result = await this.agent.generateFullArchitecture(
            { 
              type: 'system',
              components: [
                { name: 'Frontend', type: 'spa' },
                { name: 'Backend', type: 'api' }
              ]
            },
            'Test relationship directions'
          );
          return result.includes('->') && !result.includes('<-');
        }
      }
    ];

    let allPassed = true;
    for (const test of regressionTests) {
      try {
        const result = await test.test();
        console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASSED' : 'FAILED'}`);
        if (!result) allPassed = false;
      } catch (error) {
        console.log(`❌ ${test.name}: ERROR - ${error}`);
        allPassed = false;
      }
    }

    console.log(`\n🎯 Regression Test Result: ${allPassed ? 'PASSED' : 'FAILED'}`);
    return allPassed;
  }
}

// Export for use in other test files
export { StructurizrDSLAgentTester };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new StructurizrDSLAgentTester();
  
  (async () => {
    await tester.runAllTests();
    await tester.runRegressionTests();
  })().catch(console.error);
}