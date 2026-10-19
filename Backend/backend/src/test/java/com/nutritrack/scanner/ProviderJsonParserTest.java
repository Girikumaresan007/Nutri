package com.nutritrack.scanner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nutritrack.common.Confidence;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProviderJsonParserTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void parsesFencedJsonAndSanitises() {
        String text = "```json\n{\"items\":[{\"name\":\"Rice\\u0000\",\"serving_amount\":100,\"serving_unit\":\"g\",\"servings\":1.5,"
                + "\"calories\":130,\"protein\":2.7,\"carbohydrates\":28,\"fat\":0.3,\"fiber\":0.4,\"confidence\":\"MEDIUM\","
                + "\"uncertainty\":[\"portion\"],\"warnings\":[\"oil\"]}]}\n```";
        List<RawDetectedFood> out = ProviderJsonParser.parse(text, mapper);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).name()).isEqualTo("Rice");
        assertThat(out.get(0).confidence()).isEqualTo(Confidence.MEDIUM);
    }

    @Test
    void dropsItemsWithOutOfRangeOrMissingValues() {
        String text = "{\"items\":[{\"name\":\"Bad\",\"serving_amount\":100,\"serving_unit\":\"g\",\"servings\":1,"
                + "\"calories\":999999,\"protein\":1,\"carbohydrates\":1,\"fat\":1},{\"name\":\"NoNumbers\"}]}";
        assertThat(ProviderJsonParser.parse(text, mapper)).isEmpty();
    }

    @Test
    void nonJsonOutputIsAnError() {
        assertThatThrownBy(() -> ProviderJsonParser.parse("I cannot help with that", mapper)).isInstanceOf(IllegalArgumentException.class);
    }
}
