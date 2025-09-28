# Deploy security-compliance-research to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "security-compliance-research-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "security-compliance-research-endpoint" \
  --name "security-compliance-research-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > security-compliance-research-flow.yaml << EOF
display_name: "security-compliance-research"
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
      sources: "compliance-frameworks-database,azure-security-documentation,regulatory-requirements"
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: 0.1
      max_tokens: 1800
      system_message: |
        You are a cybersecurity and compliance expert specializing in Azure security services and regulatory frameworks.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file security-compliance-research-flow.yaml
