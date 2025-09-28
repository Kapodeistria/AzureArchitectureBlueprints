# 🚀 Azure AI Foundry Flow Upload Guide

## Quick Manual Upload Instructions

Your flow files are ready in `flows/interview-workflow/`. Follow these steps to upload them to Azure AI Foundry:

### 1. Access Azure AI Foundry
Navigate to: **https://ai.azure.com/**

### 2. Select Your Project
- Click on your project: **kapodeistria-1337**
- Or go directly to: https://ai.azure.com/projectsv2/kapodeistria-1337

### 3. Upload Flow
1. Click **"Flows"** in the left navigation
2. Click **"+ Create"** or **"Upload"** 
3. Select **"Upload from local"**
4. Navigate to your `flows/interview-workflow/` folder
5. Upload the following files:
   - `flow.dag.yaml` (main flow definition)
   - `requirements_prompt.jinja2` (requirements analysis prompt)
   - `architecture_prompt.jinja2` (architecture design prompt)
   - `synthesis.py` (Python synthesis script)

### 4. Configure Flow
After upload:
1. Verify the **Model Deployment** is set to: `gpt-4.1`
2. Confirm the **Connection** is set to: `Default_AzureOpenAI`
3. Check that all nodes are properly connected

### 5. Test Flow
1. Click **"Test"** in the flow interface
2. Enter a sample case study in the `case_study` input
3. Run the flow and verify output

---

## 📋 Your Flow Configuration

**Project Details:**
- **Project Name:** kapodeistria-1337
- **Resource Group:** rg-kapodeistria-3079
- **Model Deployment:** gpt-4.1
- **Endpoint:** https://kapodeistria-1337-resource.services.ai.azure.com/api/projects/kapodeistria-1337

**Flow Components:**
- ✅ Requirements Analysis (LLM Node)
- ✅ Architecture Design (LLM Node) 
- ✅ Python Synthesis (Python Node)
- ✅ All prompt templates included

---

## 🧪 Test Case Study

Use this sample for testing:

```
FinanceFlow is a payment processing company that needs to build an AI-powered fraud detection platform. They process 100,000 transactions per day, need real-time scoring within 100ms, and must comply with PCI DSS standards. The system should integrate with their existing PostgreSQL database and support machine learning model retraining. Budget is $10,000-15,000 monthly.
```

---

## 🔧 Troubleshooting

**If upload fails:**
- Ensure all files are in the same folder
- Check that `flow.dag.yaml` has valid YAML syntax
- Verify your Azure AI Foundry project has proper permissions

**If connections fail:**
- Confirm `Default_AzureOpenAI` connection exists in your project
- Verify `gpt-4.1` model deployment is available

**For debugging:**
- Use the Flow editor's **Debug** mode
- Check the **Logs** tab for detailed error messages
- Verify all input/output connections between nodes

---

## 🎯 Next Steps

Once uploaded successfully:
1. **Save** the flow in Azure AI Foundry
2. **Run** test with sample case study
3. **Deploy** as endpoint for production use
4. **Monitor** performance in Azure AI Foundry analytics

Your multi-agent interview assistant is now ready for use in Azure AI Foundry! 🎉