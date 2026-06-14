# Data Ingestion Service

A FastAPI backend module for uploading, validating, and processing CSV data files (orders, machines, inventory). Data is stored in memory using pandas DataFrames and returned as parsed JSON.

## Features

- **CSV File Upload**: Upload orders.csv, machines.csv, and inventory.csv files
- **Automatic Schema Validation**: Validates data against expected schemas
- **In-Memory Storage**: Uses pandas DataFrames for efficient data storage
- **JSON Response**: Returns parsed data in JSON format
- **Graceful Error Handling**: Handles missing columns and data type issues
- **Modular Architecture**: Clean separation of concerns with routes, services, and models

## Requirements

- Python 3.11+
- Dependencies listed in `requirements.txt`

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Project Structure

```
.
├── main.py                 # Application entry point
├── requirements.txt        # Python dependencies
├── models/                 # Pydantic models for data validation
│   ├── __init__.py
│   ├── common_models.py    # Shared response models
│   ├── order_models.py     # Order data models
│   ├── machine_models.py   # Machine data models
│   └── inventory_models.py # Inventory data models
├── services/               # Business logic layer
│   ├── __init__.py
│   ├── validation_service.py  # Schema validation
│   └── data_service.py       # Data processing and storage
└── routes/                 # API endpoint definitions
    ├── __init__.py
    └── data_routes.py      # Data upload and retrieval endpoints
```

## Running the Service

Start the FastAPI server:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The service will be available at `http://localhost:8000`

## API Documentation

Once the service is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Upload Endpoints

#### POST /api/v1/upload/orders
Upload and process orders.csv file

**Request**: 
- Content-Type: multipart/form-data
- Body: file (CSV file)

**Response**: UploadResponse with validation results

#### POST /api/v1/upload/machines
Upload and process machines.csv file

**Request**: 
- Content-Type: multipart/form-data
- Body: file (CSV file)

**Response**: UploadResponse with validation results

#### POST /api/v1/upload/inventory
Upload and process inventory.csv file

**Request**: 
- Content-Type: multipart/form-data
- Body: file (CSV file)

**Response**: UploadResponse with validation results

### Data Retrieval Endpoints

#### GET /api/v1/data/orders?limit=1000
Retrieve stored orders data as JSON

**Query Parameters**:
- limit (optional): Maximum number of rows to return (default: 1000)

**Response**: JSON with orders data

#### GET /api/v1/data/machines?limit=1000
Retrieve stored machines data as JSON

**Query Parameters**:
- limit (optional): Maximum number of rows to return (default: 1000)

**Response**: JSON with machines data

#### GET /api/v1/data/inventory?limit=1000
Retrieve stored inventory data as JSON

**Query Parameters**:
- limit (optional): Maximum number of rows to return (default: 1000)

**Response**: JSON with inventory data

### Summary Endpoints

#### GET /api/v1/summary/orders
Get summary statistics for stored orders data

**Response**: JSON with summary information (row count, columns, memory usage)

#### GET /api/v1/summary/machines
Get summary statistics for stored machines data

**Response**: JSON with summary information

#### GET /api/v1/summary/inventory
Get summary statistics for stored inventory data

**Response**: JSON with summary information

### Data Management Endpoints

#### DELETE /api/v1/data/orders
Clear all stored orders data from memory

**Response**: Confirmation message

#### DELETE /api/v1/data/machines
Clear all stored machines data from memory

**Response**: Confirmation message

#### DELETE /api/v1/data/inventory
Clear all stored inventory data from memory

**Response**: Confirmation message

#### DELETE /api/v1/data/all
Clear all stored data from memory

**Response**: Confirmation message

### Health Check

#### GET /api/v1/health
Check service health and data store status

**Response**: JSON with health status and data counts

## Expected CSV Schemas

### orders.csv
Expected columns:
- order_id (string)
- customer_id (string)
- order_date (string, YYYY-MM-DD format)
- product_id (string)
- quantity (integer)
- unit_price (float)
- total_amount (float)
- status (string)
- shipping_address (string)

### machines.csv
Expected columns:
- machine_id (string)
- machine_name (string)
- machine_type (string)
- location (string)
- status (string)
- capacity (float)
- efficiency (float)
- last_maintenance_date (string, YYYY-MM-DD format)
- operator_id (string)

### inventory.csv
Expected columns:
- inventory_id (string)
- product_id (string)
- product_name (string)
- sku (string)
- quantity_on_hand (integer)
- reorder_level (integer)
- unit_cost (float)
- location (string)
- category (string)
- supplier_id (string)

## Validation Behavior

- **Missing Columns**: Reported as warnings in validation_errors
- **Extra Columns**: Reported as info messages and preserved in data
- **Data Type Issues**: Reported as warnings but data is still stored
- **Empty Rows**: Reported as warnings
- **Critical Errors**: Only parsing errors (empty file, invalid CSV) cause failure

## Example Usage with cURL

### Upload orders.csv
```bash
curl -X POST "http://localhost:8000/api/v1/upload/orders" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@orders.csv"
```

### Get orders data
```bash
curl -X GET "http://localhost:8000/api/v1/data/orders?limit=100"
```

### Get orders summary
```bash
curl -X GET "http://localhost:8000/api/v1/summary/orders"
```

### Clear orders data
```bash
curl -X DELETE "http://localhost:8000/api/v1/data/orders"
```

## Example Usage with Python

```python
import requests

# Upload orders.csv
with open('orders.csv', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/api/v1/upload/orders',
        files={'file': f}
    )
    print(response.json())

# Get orders data
response = requests.get('http://localhost:8000/api/v1/data/orders?limit=100')
print(response.json())

# Get summary
response = requests.get('http://localhost:8000/api/v1/summary/orders')
print(response.json())
```

## Notes

- Data is stored in memory and will be lost when the service restarts
- For production use, consider implementing persistent storage
- The service accepts any CSV file and will preserve extra columns not in the expected schema
- All validation errors are returned in the response for transparency

## NVIDIA AgentIQ Order Agent

This repo includes an AgentIQ-compatible Order Prioritization Agent.

### Responsibilities

- Reads stored `orders` data from `DataService`
- Ranks orders by `due_date`, `quantity`, and `urgency_score`
- Returns a prioritized JSON order queue
- Exposes the Python function `prioritize_orders()`

### AgentIQ setup

Install the standard app dependencies first:

```bash
pip install -r requirements.txt
```

Install NVIDIA AgentIQ / NeMo Agent Toolkit following NVIDIA's current package instructions, then install this project so AgentIQ can discover the component entry point:

```bash
pip install -e .
```

Run the AgentIQ workflow:

```bash
aiq run --config_file configs/order_agent_config.yml
```

Serve the workflow:

```bash
aiq serve --config_file configs/order_agent_config.yml
```

### Agent definition

The AgentIQ function is registered in `agents/order_agent/register.py` as `_type: order_prioritizer`. The workflow definition lives in `configs/order_agent_config.yml` and wires the function into a `react_agent`.

### Standalone usage

You can also call the Python entry point directly:

```bash
python prioritize_orders.py --limit 10
```

Programmatic usage:

```python
from agents.order_agent.order_prioritizer import prioritize_orders

result = prioritize_orders()
```

The function returns a JSON-serializable dictionary:

```json
{
  "status": "success",
  "agent": "order_prioritizer",
  "total_orders": 0,
  "returned_orders": 0,
  "priority_model": {
    "rank_order": "highest priority_score first",
    "factors": ["due_date", "quantity", "urgency_score"],
    "weights": {
      "due_date": 0.4,
      "quantity": 0.3,
      "urgency_score": 0.3
    }
  },
  "orders": [],
  "errors": []
}
```

## NVIDIA AgentIQ Inventory Agent

This repo also includes an AgentIQ-compatible Inventory Agent.

### Responsibilities

- Reads uploaded inventory data from `DataService` or falls back to `inventory.csv`
- Verifies material availability for order requirements
- Detects shortages
- Generates inventory alerts

### AgentIQ setup

Install the project so AgentIQ can discover both component entry points:

```bash
pip install -e .
```

Run the inventory workflow:

```bash
aiq run --config_file configs/inventory_agent_config.yml
```

Serve the workflow:

```bash
aiq serve --config_file configs/inventory_agent_config.yml
```

### Agent definition

The AgentIQ function is registered in `agents/inventory_agent/register.py` as `_type: inventory_agent`. The workflow definition lives in `configs/inventory_agent_config.yml` and wires the function into a `react_agent`.

### Standalone usage

Check a single material requirement:

```bash
python verify_inventory.py --order-id O3 --material steel --required-quantity 12
```

Programmatic usage:

```python
from agents.inventory_agent.inventory_checker import verify_inventory


## What-If Simulation Agent

This repository includes a What-If Simulation Agent that can estimate the impact of scenarios such as machine failures, inventory reductions, or rush order insertions.

Agent entry point: `agents/what_if_agent/register.py`

Example scenario payloads:

- Machine failure:

```json
{
  "schedule": [ ... ],
  "machines": [ ... ],
  "scenario": {"type": "machine_failure", "machine": "M-1"}
}
```

- Inventory reduction:

```json
{
  "schedule": [ ... ],
  "inventory": [ ... ],
  "scenario": {"type": "inventory_reduction", "product_id": "P1", "reduction": 10}
}
```

- Rush order insertion:

```json
{
  "schedule": [ ... ],
  "machines": [ ... ],
  "scenario": {"type": "rush_order", "order": {"order":"R-1","machine":"M-2","start":"2026-06-15T08:00:00","end":"2026-06-15T10:00:00"}}
}
```

Run locally with the CLI:

```bash
python simulate_what_if.py --file example_payload.json
```

AgentIQ registration is provided so you can wire this function into workflows per your AgentIQ configuration.


## Factory Copilot (/copilot)

New endpoints:

- `POST /copilot/chat` — send a user message with the current `schedule` JSON. Returns `session_id`, `reply`, `provider`, and `status`.
- `GET /copilot/history?session_id=...` — retrieve the conversation history for a session.

Request body for `/copilot/chat`:

```json
{
  "message": "Why is order O3 delayed?",
  "schedule": [ { "order": "O3", "status": "delayed", "reason": "missing raw material" } ],
  "session_id": null,
  "use_nim": true
}
```

Notes:

- The copilot will try NVIDIA NIM when `NVIDIA_API_KEY` is set. Otherwise it falls back to a lightweight local responder.
- Chat history is kept in-memory in the running process and is not persisted across restarts.


## Production Explanation Agent (/explain)

This project includes a Production Explanation Agent that uses NVIDIA NIM (when configured) to generate concise natural-language explanations for a production schedule JSON input. The FastAPI endpoint is exposed at `/explain`.

Environment variables:

- `NVIDIA_API_KEY`: Your NVIDIA NIM API key (required to use NIM). If not set, the service falls back to a local heuristic explanation.
- `NVIDIA_NIM_BASE_URL` (optional): Base URL for the NIM API (default: `https://integrate.api.nvidia.com/v1`).
- `NVIDIA_NIM_MODEL` (optional): Model id to use (default: `nvidia/llama-3.1-nemotron-70b-instruct`).

Example request (JSON body):

```json
{
  "schedule": [
    {
      "order": "O-100",
      "machine": "M-1",
      "start": "2026-06-15T08:00:00",
      "end": "2026-06-15T12:00:00",
      "status": "scheduled"
    }
  ],
  "context": {
    "prioritized_orders": [
      {"order": "O-100", "priority_score": 9.5, "queue_rank": 1}
    ]
  },
  "use_nim": true
}
```

cURL example:

```bash
curl -X POST "http://localhost:8000/explain" \
  -H "Content-Type: application/json" \
  -d '{"schedule":[{"order":"O-100","machine":"M-1","start":"2026-06-15T08:00:00","end":"2026-06-15T12:00:00","status":"scheduled"}],"use_nim":true}'
```

Response shape is defined by the Pydantic model `ExplanationResponse` and contains `status`, `provider`, `summaries`, and `errors` fields.


result = verify_inventory(order_id="O3", material="steel", required_quantity=12)
```

Example shortage alert:

```json
{
  "order": "O3",
  "status": "blocked",
  "reason": "insufficient steel"
}
```

## NVIDIA AgentIQ Machine Agent

This repo includes an AgentIQ-compatible Machine Agent for production allocation.

### Responsibilities

- Reads uploaded machine availability from `DataService` or falls back to `machines.csv`
- Detects machine downtime from machine status and downtime reason fields
- Detects overloaded machines from utilization, load, and capacity
- Recommends the best machine assignment using capacity fit, load headroom, and efficiency

### AgentIQ setup

Install the project so AgentIQ can discover the machine component entry point:

```bash
pip install -e .
```

Run the machine workflow:

```bash
aiq run --config_file configs/machine_agent_config.yml
```

Serve the workflow:

```bash
aiq serve --config_file configs/machine_agent_config.yml
```

### Agent definition

The AgentIQ function is registered in `agents/machine_agent/register.py` as `_type: machine_agent`. The workflow definition lives in `configs/machine_agent_config.yml` and wires the function into a `react_agent`.

### Standalone usage

Check a machine assignment:

```bash
python allocate_machine.py --order-id O9 --machine-type CNC --required-capacity 50
```

Programmatic usage:

```python
from agents.machine_agent.machine_allocator import allocate_machine

result = allocate_machine(order_id="O9", machine_type="CNC", required_capacity=50)
```

AgentIQ tool input can be JSON:

```json
{
  "order": "O9",
  "machine_type": "CNC",
  "required_capacity": 50
}
```

Example allocation response:

```json
{
  "order": "O9",
  "status": "assigned",
  "machine_id": "M3",
  "machine_name": "CNC-3",
  "machine_type": "CNC",
  "required_capacity": 50,
  "reason": "best available machine by capacity, load, and efficiency"
}
```

## Production Explanation Agent

The Production Explanation Agent explains production schedule JSON using NVIDIA NIM when configured, with a deterministic local fallback for development.

### Environment

```bash
set NVIDIA_API_KEY=your-nvidia-api-key
set NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
set NVIDIA_NIM_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
```

### FastAPI endpoint

```http
POST /explain
```

Request:

```json
{
  "schedule": [
    {
      "order": "O1",
      "machine": "M1",
      "start": "09:00",
      "end": "11:00"
    }
  ],
  "context": {
    "prioritized_orders": []
  },
  "use_nim": true
}
```

Response:

```json
{
  "status": "success",
  "provider": "nim",
  "summaries": [
    "Order O1 was scheduled first because it had the highest priority. No delay was detected. It was assigned to machine M1 from 09:00 to 11:00 because the machine was available."
  ],
  "errors": []
}
```

### AgentIQ setup

The AgentIQ function is registered in `agents/explanation_agent/register.py` as `_type: explanation_agent`.

```bash
aiq run --config_file configs/explanation_agent_config.yml
```

### Standalone usage

```bash
python explain_schedule.py --file schedule.json
```

Disable NIM for local deterministic summaries:

```bash
python explain_schedule.py --file schedule.json --no-nim
```
