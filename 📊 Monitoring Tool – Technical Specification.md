## 1. Overview

The monitoring tool is designed to:

- Capture, validate, and track classification results
    
- Monitor classification quality over time
    
- Generate and analyze confusion matrices
    
- Support both **operational users (WiMi)** and **control/oversight roles**
    

Core functionality includes:

- Data input & validation
    
- Rolling confusion matrix analysis
    
- Case-level inspection & annotation
    
- Workflow monitoring
    

---

## 2. System Architecture

The application consists of **three main dashboards**:

1. **Input Dashboard (Operational / WiMi)**
    
2. **Matrix Dashboard (Analysis & Monitoring)**
    
3. **Control Dashboard (Process Monitoring)**
    

---

## 3. Input Dashboard

### 3.1 Purpose

Enable fast, minimal-friction data entry and validation of individual cases.

---

### 3.2 Data Fields

#### User Input Fields

- `vk_number` (string, unique identifier)
    
- `device_name` (string)
    
- `tricia_s` (int)
    
- `tricia_p` (int)
    
- `tricia_d` (int)
    
- `user_s` (int)
    
- `user_d` (int)
    

---

### 3.3 Validation Workflow

- Button: **"Validate"**
    
    - If no corrections are made → auto-copy:
        
        - `user_s = tricia_s`
            
        - `user_d = tricia_d`
            
- Button: **"Save"**
    
    - Finalizes validation and persists the record
        

---

### 3.4 UX Requirements

- Minimize manual input effort
    
- Pre-fill fields where possible
    
- Optimize for rapid repetitive entry
    

---

### 3.5 Automatic Metadata

System should automatically capture:

- `input_timestamp` (datetime)
    
- `analysis_date` (derived from `vk_number`)
    
- `user_id` (auto-detected if possible, fallback manual)
    

---

### 3.6 Duplicate Handling

If a `vk_number` already exists:

Trigger modal dialog:

Options:

- `"Edit existing entry"`
    
- `"Cancel input"`
    

---

### 3.7 User Management (Minimal)

- Lightweight user identification
    
- No complex role system required (initially)
    

---

## 4. Matrix Dashboard (Core Monitoring)

### 4.1 Purpose

- Display and analyze confusion matrices
    
- Enable detailed case-level inspection
    

---

### 4.2 Time-Based Analysis

#### Predefined Intervals

- Last 3 months
    
- Last 6 months
    
- Last 12 months
    
- All time
    

#### Custom Interval

- User-defined date range
    

#### UI Control

- Dropdown selector:
    
    ```
    [3M | 6M | 12M | ALL | CUSTOM]
    ```
    

---

### 4.3 Data Display

- Confusion Matrix (aggregated)
    
- Case Table (all cases in selected period)
    

---

## 4.4 Case Table Columns

- `device_name`
    
- `tricia_s`
    
- `user_s`
    
- `tricia_d`
    
- `user_d`
    
- `category`
    
- `comment`
    
- `is_excluded` (Streichresultat)
    
- `is_reviewed`
    

---

## 4.5 Case Filtering & Isolation

### Matrix Interaction

- Clicking a confusion matrix cell filters corresponding cases
    

---

### Toggle Filters

#### Case Scope

- All cases
    
- Only problematic cases
    

**Definition:**

```
abs(user_class - tricia_class) >= 2
```

---

### Exclusion Handling

- Toggle:
    
    - Include excluded cases
        
    - Exclude excluded cases
        

---

### Risk-Based Filtering (Optional)

- False low classification (high risk)
    
- False high classification (low risk)
    
- All misclassifications
    

---

## 4.6 Case Actions

Each row supports:

- `mark_reviewed()`
    
- `add_comment(text)`
    
- `toggle_exclusion()`
    
- `set_category(value)`
    

### Category Values:

- `"no_issue"`
    
- `"monitor"`
    
- `"problem"`
    

---

### UI Enhancements (Nice-to-have)

#### Color Coding

- Green:
    
    ```
    deviation <= 1
    ```
    
- Red:
    
    ```
    deviation > 1
    ```
    

#### Risk Differentiation:

- High risk → false low
    
- Low risk → false high
    

---

## 4.7 Statistical Evaluation

### Metrics

- Acceptance thresholds (configurable)
    
- Actual observed metrics
    

---

### Visualization

- Confusion matrix cells colored:
    
    - Green → within threshold
        
    - Red → outside threshold
        

---

### Exclusion Handling

- Toggle:
    
    - Include/exclude excluded cases in calculations
        

---

### Time Basis

All calculations use:

```
analysis_date (derived from vk_number)
```

---

### Configurability

Acceptance thresholds should be:

- Centrally configurable
    
- Stored in:
    
    - Config file OR
        
    - Admin settings UI
        

---

## 5. Control Dashboard

### 5.1 Purpose

Monitor whether operational users (WiMi) completed their tasks.

---

### 5.2 Features

- Time-based list generation
    

---

### 5.3 Table Columns

- `vk_number`
    
- `analysis_date`
    
- `input_timestamp`
    
- `user_id`
    

---

### 5.4 Functionality

- Filter by date range
    
- Identify missing or delayed entries
    

---

## 6. Data Handling

### 6.1 Import

- Supported formats:
    
    - CSV
        
    - Excel
        

Features:

- Default dataset provided
    
- Option to upload alternative dataset
    

---

### 6.2 Export

- Export filtered data as:
    
    - CSV
        
    - Excel
        

Available in:

- Matrix Dashboard
    
- Control Dashboard
    

---

## 6.3 Reporting (Nice-to-have)

- Generate report of current view
    
- Excludes Input Dashboard
    

---

## 7. Data Model (Suggested)

```python
class Case:
    vk_number: str
    device_name: str
    
    tricia_s: int
    tricia_p: int
    tricia_d: int
    
    user_s: int
    user_d: int
    
    category: str
    comment: str
    
    is_excluded: bool
    is_reviewed: bool
    
    input_timestamp: datetime
    analysis_date: datetime
    user_id: str
```

---

## 8. Key Logic Definitions

### 8.1 Deviation

```python
deviation = abs(user_value - tricia_value)
```

---

### 8.2 Problem Case

```python
is_problem = deviation >= 2
```

---

### 8.3 Acceptance Criterion

```python
is_acceptable = deviation <= threshold  # threshold configurable
```

---

## 9. Non-Functional Requirements

- Fast UI interaction (low latency filtering)
    
- Scalable for growing dataset
    
- Clear UX for non-technical users
    
- Robust duplicate handling
    
- Modular architecture (future extensions)
    
