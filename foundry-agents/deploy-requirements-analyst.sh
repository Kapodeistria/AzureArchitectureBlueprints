# Deploy requirements-analyst to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "requirements-analyst-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "requirements-analyst-endpoint" \
  --name "requirements-analyst-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > requirements-analyst-flow.yaml << EOF
display_name: "requirements-analyst"
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
      temperature: 0.1
      max_tokens: 1500
      system_message: |
        You are a Requirements Analyst Agent specialized in extracting and categorizing requirements from case studies. Be thorough and specific in identifying both explicit and implicit requirements.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file requirements-analyst-flow.yaml
