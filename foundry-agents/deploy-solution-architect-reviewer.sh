# Deploy solution-architect-reviewer to Azure AI Foundry

# Create the agent flow
az ml online-endpoint create \
  --name "solution-architect-reviewer-endpoint" \
  --auth-mode key \
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \
  --endpoint-name "solution-architect-reviewer-endpoint" \
  --name "solution-architect-reviewer-v1" \
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \
  --instance-count 1 \
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > solution-architect-reviewer-flow.yaml << EOF
display_name: "solution-architect-reviewer"
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
      max_tokens: 2000
      system_message: |
        You are a highly experienced Senior Solution Architect conducting thorough technical reviews. Provide detailed, constructive feedback with scoring.
      user_message: |
        Case Study: \${inputs.case_study}
        Requirements: \${inputs.requirements}
        RAG Context: \${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file solution-architect-reviewer-flow.yaml
