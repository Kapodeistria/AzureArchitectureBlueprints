from promptflow import tool
import time
import json

@tool
def track_performance(start_time: float) -> dict:
    """Track workflow performance metrics"""
    
    end_time = time.time()
    total_time = end_time - start_time
    
    metrics = {
        "total_execution_time_ms": int(total_time * 1000),
        "start_time": start_time,
        "end_time": end_time,
        "status": "completed",
        "workflow_version": "v1.0"
    }
    
    return metrics
