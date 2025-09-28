# Deploy azure-services-research to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "azure-services-research-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "azure-services-research-endpoint" \
  --name "azure-services-research-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > azure-services-research-flow.yaml << EOF
display_name: "azure-services-research"
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
      sources: "azure-services-documentation,azure-pricing-calculator,azure-architecture-center"
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: 0.2
      max_tokens: 2000
      system_message: |
        You are an Azure services research specialist with access to the latest Azure documentation and pricing information. Research and provide comprehensive information about Azure services relevant to the given requirements.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file azure-services-research-flow.yaml
