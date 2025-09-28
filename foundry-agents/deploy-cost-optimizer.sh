# Deploy cost-optimizer to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "cost-optimizer-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "cost-optimizer-endpoint" \
  --name "cost-optimizer-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > cost-optimizer-flow.yaml << EOF
display_name: "cost-optimizer"
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
      sources: "azure-pricing-database,cost-optimization-patterns,reserved-instances-calculator"
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: 0.3
      max_tokens: 2000
      system_message: |
        You are an Azure Cost Optimization specialist focused on enterprise TCO analysis and cost-effective architecture recommendations.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file cost-optimizer-flow.yaml
