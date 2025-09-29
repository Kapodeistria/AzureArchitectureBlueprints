#!/usr/bin/env python3
"""Deploy Bicep infrastructure using Azure Python SDK to avoid CLI JSON bug."""

import json
import os
import subprocess
import sys
from azure.identity import AzureCliCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.resource.resources.models import Deployment, DeploymentProperties, DeploymentMode

# Configuration from environment variables or defaults
RESOURCE_GROUP = os.getenv("AZURE_RESOURCE_GROUP", "rg-agentic-waf")
SUBSCRIPTION_ID = os.getenv("AZURE_SUBSCRIPTION_ID")
BICEP_FILE = os.getenv("BICEP_TEMPLATE_FILE", "infra/bicep/main.bicep")
PARAMETERS_FILE = os.getenv("BICEP_PARAMETERS_FILE", "infra/bicep/main.parameters.json")

if not SUBSCRIPTION_ID:
    print("Error: AZURE_SUBSCRIPTION_ID environment variable is required", file=sys.stderr)
    print("Set it with: export AZURE_SUBSCRIPTION_ID=<your-subscription-id>", file=sys.stderr)
    sys.exit(1)

def compile_bicep(bicep_path):
    """Compile Bicep to ARM JSON."""
    print(f"Compiling {bicep_path}...")
    result = subprocess.run(
        ["az", "bicep", "build", "--file", bicep_path, "--stdout"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Error compiling Bicep: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)

def load_parameters(param_file):
    """Load parameters from JSON file."""
    with open(param_file) as f:
        params = json.load(f)
    # Extract just the parameter values
    return {k: v["value"] for k, v in params["parameters"].items()}

def main():
    print("Initializing Azure deployment...")

    # Get credentials
    credential = AzureCliCredential()
    client = ResourceManagementClient(credential, SUBSCRIPTION_ID)

    # Compile Bicep template
    template = compile_bicep(BICEP_FILE)

    # Load parameters
    parameters = load_parameters(PARAMETERS_FILE)

    # Create deployment
    deployment_name = "infrastructure-deployment"
    deployment_properties = DeploymentProperties(
        mode=DeploymentMode.INCREMENTAL,
        template=template,
        parameters={k: {"value": v} for k, v in parameters.items()}
    )
    deployment = Deployment(properties=deployment_properties)

    print(f"Starting deployment '{deployment_name}' to resource group '{RESOURCE_GROUP}'...")

    # Start deployment
    operation = client.deployments.begin_create_or_update(
        RESOURCE_GROUP,
        deployment_name,
        deployment
    )

    print("Deployment started. Waiting for completion...")
    result = operation.result()

    print(f"\n✓ Deployment completed: {result.properties.provisioning_state}")

    if result.properties.outputs:
        print("\nOutputs:")
        for key, value in result.properties.outputs.items():
            print(f"  {key}: {value.get('value', 'N/A')}")

if __name__ == "__main__":
    main()