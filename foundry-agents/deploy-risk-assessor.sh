# Deploy risk-assessor to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "risk-assessor-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "risk-assessor-endpoint" \
  --name "risk-assessor-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > risk-assessor-flow.yaml << EOF
display_name: "risk-assessor"
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
      sources: ""
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: 0.2
      max_tokens: 1800
      system_message: |
        You are a Risk Assessment specialist for enterprise Azure solutions with focus on business continuity and security risk analysis.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file risk-assessor-flow.yaml
