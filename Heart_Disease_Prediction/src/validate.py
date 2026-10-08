import pandas as pd
import joblib

def validate_prediction(model_path, data_path):
    pipeline = joblib.load(model_path)
    df = pd.read_csv(data_path)
    X = df.drop(columns=['num'])
    
    sample = X.iloc[[0]]
    
    prediction = pipeline.predict(sample)
    probabilities = pipeline.predict_proba(sample)
    
    print("Validation Successful")
    print(f"Sample prediction: {prediction[0]}")
    print(f"Probabilities (Class 0, Class 1): {probabilities[0]}")

if __name__ == "__main__":
    validate_prediction('model/model.joblib', 'data/heart_disease.csv')
