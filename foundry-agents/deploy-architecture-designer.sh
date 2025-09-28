# Deploy architecture-designer to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "architecture-designer-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "architecture-designer-endpoint" \
  --name "architecture-designer-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > architecture-designer-flow.yaml << EOF
display_name: "architecture-designer"
type: standard
inputs:
  case_study:
    type: string
  requirements:
    type: string
outputs:
  analysis:
    type: string
nodes:
  - name: rag_lookup
    type: python
    source:
      type: code
      path: rag_lookup.py
    inputs:
      query: \${inputs.case_study}
      sources: "azure-architecture-patterns,solution-templates,reference-implementations"
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: 0.4
      max_tokens: 3000
      system_message: |
        You are a Senior Azure Solution Architect with deep expertise in enterprise cloud architecture. Design comprehensive, production-ready Azure solutions.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file architecture-designer-flow.yaml
