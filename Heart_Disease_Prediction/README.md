# Heart Disease Prediction

## Purpose
An educational machine learning demonstration project that builds a complete binary classification pipeline to predict the presence of heart disease.

## Disclaimer
**This project is an educational/research machine learning demonstration and is not a medical diagnosis system. Predictions must not be used for medical decision-making.**

## Dataset
- **Source**: UCI Machine Learning Repository (Heart Disease Dataset - Cleveland).
- **Shape**: 303 rows and 14 columns.
- **Features**: 
  - Continuous: `age`, `trestbps`, `chol`, `thalach`, `oldpeak`
  - Categorical/Ordinal: `sex`, `cp`, `fbs`, `restecg`, `exang`, `slope`, `ca`, `thal`
- **Target**: `num` (Normalized to a binary classification target where `target = 1` indicates presence of disease and `target = 0` indicates absence).

## Preprocessing
- Missing values in categorical features (`ca`, `thal`) are imputed using the most frequent value.
- Missing values in continuous features are imputed using the median.
- Categorical features are One-Hot Encoded.
- Continuous features are scaled using Standard Scaling.

## Model
- **Algorithm**: Logistic Regression
- **Why**: Selected for its simplicity, efficiency, and ability to provide probability estimates. It performs well for binary classification on small, tabular datasets and is highly interpretable, making it ideal for an educational demonstration.

## Evaluation
- **Accuracy**: 0.8852
- **Precision**: 0.8387
- **Recall**: 0.9286
- **F1 Score**: 0.8814

*Note on Recall*: In the context of medical classification, recall measures the proportion of actual positive cases (disease present) correctly identified by the model. High recall minimizes false negatives, which is crucial since missing a positive diagnosis is typically considered a more severe error than a false positive.

## Execution

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Download Dataset
```bash
python src/download_data.py
```
*(Ensure to run from the root directory or use the provided script)*

### Run Streamlit Application
```bash
streamlit run app.py
```
This will launch a local web server (usually at `http://localhost:8501`) providing a clean, professional UI for entering feature values and generating model predictions with probability estimates.

### Run Training Pipeline (Optional)
```bash
python src/train.py
```
The trained model artifact is saved to: `model/model.joblib`.

### Run Validation Script
```bash
python src/validate.py
```

